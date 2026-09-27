#!/usr/bin/env node
// Generates a PKCS#12 release keystore for signing the Android APK -- no Java/keytool required.
//
//   npm run keystore                       -> writes release.p12 (+ release.p12.b64) with a random password
//   node scripts/gen-keystore.mjs out.p12 --password "..." --alias outpostsurge
//
// The password can also come from the KEYSTORE_PASSWORD environment variable.
// NEVER commit the outputs (*.p12 / *.b64 are gitignored). Keep a private backup of the .p12 and its
// password: every future update of the app must be signed with the same key, or Android refuses to
// install it over the old version.
import { writeFileSync, existsSync } from 'node:fs';
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { resolve, basename } from 'node:path';
import forge from 'node-forge';

const args = process.argv.slice(2);
function takeFlag(name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const value = args[i + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value`);
  args.splice(i, 2);
  return value;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/gen-keystore.mjs [output.p12] [--alias name] [--password pw] [--force]');
  process.exit(0);
}

const alias = takeFlag('--alias') ?? 'outpostsurge';
let password = takeFlag('--password') ?? process.env.KEYSTORE_PASSWORD;
const force = args.includes('--force');
const outPath = resolve(args.filter((a) => a !== '--force')[0] ?? 'release.p12');
const b64Path = `${outPath}.b64`;

if (existsSync(outPath) && !force) {
  console.error(`Refusing to overwrite existing ${outPath} (pass --force if you really mean it).`);
  process.exit(1);
}
const generatedPassword = !password;
if (!password) password = randomBytes(18).toString('base64url'); // 24 chars, shell-safe
if (password.length < 6) throw new Error('Keystore password must be at least 6 characters.');

// RSA 2048 key via Node's native crypto (fast), then converted for node-forge's PKCS#12 writer.
const { privateKey: privPem, publicKey: pubPem } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const privateKey = forge.pki.privateKeyFromPem(privPem);
const publicKey = forge.pki.publicKeyFromPem(pubPem);

// Self-signed X.509 v3 certificate, valid for 30 years (Android only checks the key stays the same).
const cert = forge.pki.createCertificate();
cert.publicKey = publicKey;
cert.serialNumber = '01' + randomBytes(15).toString('hex'); // positive, 16 bytes
const now = new Date();
cert.validity.notBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
cert.validity.notAfter = new Date(now);
cert.validity.notAfter.setFullYear(now.getFullYear() + 30);
const subject = [
  { name: 'commonName', value: 'Outpost Surge' },
  { name: 'organizationName', value: 'Outpost Surge' },
];
cert.setSubject(subject);
cert.setIssuer(subject);
cert.setExtensions([
  { name: 'basicConstraints', cA: false },
  { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
  { name: 'subjectKeyIdentifier' },
]);
cert.sign(privateKey, forge.md.sha256.create());

// PKCS#12 with 3DES (PBE-SHA1-3DES) bags + SHA-1 MAC: the most widely compatible combination for
// Java's KeyStore (used by the Android Gradle Plugin / apksigner). The friendlyName becomes the alias.
const p12Asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, [cert], password, {
  algorithm: '3des',
  friendlyName: alias,
  generateLocalKeyId: true,
  count: 10000,
});
const p12Der = Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');

// Sanity check: re-open the keystore with the password and make sure key + cert are there.
const reopened = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Der.toString('binary')), password);
const keyBags = reopened.getBags({ friendlyName: alias, bagType: forge.pki.oids.pkcs8ShroudedKeyBag }).friendlyName ?? [];
const certBags = reopened.getBags({ friendlyName: alias, bagType: forge.pki.oids.certBag }).friendlyName ?? [];
if (keyBags.length !== 1 || certBags.length !== 1) throw new Error('Keystore self-check failed.');

writeFileSync(outPath, p12Der);
writeFileSync(b64Path, p12Der.toString('base64'));

const sha256 = forge.md.sha256.create();
sha256.update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());
const fingerprint = sha256.digest().toHex().toUpperCase().match(/../g).join(':');

const file = basename(outPath);
console.log(`
Created ${outPath}
  type        PKCS12 (RSA 2048, SHA256withRSA, valid until ${cert.validity.notAfter.toISOString().slice(0, 10)})
  alias       ${alias}
  password    ${generatedPassword ? password + '   <-- generated; save it in your password manager NOW' : '(the one you supplied)'}
  key pass    same as the store password
  SHA-256     ${fingerprint}
Also wrote  ${b64Path}  (base64 of the keystore, for the GitHub secret)

GitHub repository secrets (Settings > Secrets and variables > Actions), used by .github/workflows/android.yml:
  ANDROID_KEYSTORE_BASE64    contents of ${basename(b64Path)}
  ANDROID_KEYSTORE_PASSWORD  the password above
  ANDROID_KEY_ALIAS          ${alias}          (optional, defaults to outpostsurge)
  ANDROID_KEY_PASSWORD       same as the store password (optional)

With the GitHub CLI:
  gh secret set ANDROID_KEYSTORE_BASE64 < ${basename(b64Path)}
  gh secret set ANDROID_KEYSTORE_PASSWORD      (paste the password when prompted)
  gh secret set ANDROID_KEY_ALIAS --body ${alias}

Then back up ${file} + password somewhere private and delete the local copies:
  never commit them. Losing this key means players must uninstall to get future updates.
`);
