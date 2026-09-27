#!/usr/bin/env node
// Generates every PNG icon / splash image from the master artwork in public/icon.svg.
//
//   npm run icons
//
// Outputs (all committed, so CI never has to regenerate them):
//   public/icons/icon-192.png, icon-512.png          PWA "any" icons (rounded square)
//   public/icons/icon-maskable-512.png               PWA maskable icon (full bleed, emblem in the 80% safe zone)
//   public/icons/apple-touch-icon.png                iOS home-screen icon, 180x180, opaque full bleed
//   android/app/src/main/res/mipmap-<dpi>/ic_launcher*.png            legacy, round + adaptive fg/bg layers
//   android/app/src/main/res/drawable-<dpi>/splash_logo.png           centred logo for the launch splash
//
// Requires the `sharp` devDependency (bundles its own libvips, no system packages needed).
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconSvg = await readFile(join(root, 'public/icon.svg'), 'utf8');

const defs = iconSvg.match(/^\s*(<defs>[\s\S]*?<\/defs>)/m)?.[1];
const emblem = iconSvg.match(/<!-- emblem:start -->([\s\S]*?)<!-- emblem:end -->/)?.[1];
if (!defs || !emblem) {
  throw new Error('public/icon.svg must contain <defs> and the emblem:start/emblem:end markers');
}

const SPLASH_BG = '#14202c'; // matches --bg-dark in src/ui/styles.css and capacitor.config.ts

// Emblem design space: 512x512, visual centre (256, 263). Its farthest point (outline included) is
// ~254 units from that centre, which the safe-zone scales below are derived from.
const EMBLEM_RADIUS = 254;
const emblemAt = (cx, cy, scale) =>
  `<g transform="translate(${cx} ${cy}) scale(${scale}) translate(-256 -263)">${emblem}</g>`;

const svgDoc = (w, h, vbW, vbH, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${vbW} ${vbH}">${defs}${body}</svg>`;

const fullBleedBg = `<rect width="512" height="512" fill="url(#os-bg)"/><circle cx="256" cy="256" r="236" fill="url(#os-glow)"/>`;

/** Opaque square icon: background to the edges, emblem scaled to `safeRadius` (fraction of half-size). */
const fullBleedIcon = (size, safeRadius) =>
  svgDoc(size, size, 512, 512, fullBleedBg + emblemAt(256, 256, (256 * safeRadius) / EMBLEM_RADIUS));

/** Circular legacy launcher icon (Android < 8 "round icon"). */
const roundIcon = (size) =>
  svgDoc(
    size, size, 512, 512,
    `<circle cx="256" cy="256" r="256" fill="url(#os-bg)"/><circle cx="256" cy="256" r="236" fill="url(#os-glow)"/>` +
      emblemAt(256, 258, (256 * 0.78) / EMBLEM_RADIUS),
  );

/** Adaptive icon foreground: transparent, emblem inside the 66/108 dp safe circle (radius 0.611). */
const adaptiveForeground = (size) => svgDoc(size, size, 512, 512, emblemAt(256, 256, (256 * 0.58) / EMBLEM_RADIUS));
const adaptiveBackground = (size) => svgDoc(size, size, 512, 512, fullBleedBg);

/** Splash logo: emblem with a soft glow on a transparent canvas (placed on SPLASH_BG by drawable/splash.xml). */
const splashLogo = (size) =>
  svgDoc(size, size, 512, 512, `<circle cx="256" cy="256" r="256" fill="url(#os-glow)"/>` + emblemAt(256, 258, 0.78));

const written = [];
async function out(relPath, svg, size, { density } = {}) {
  const file = join(root, relPath);
  await mkdir(dirname(file), { recursive: true });
  const png = await sharp(Buffer.from(svg), density ? { density } : {})
    .resize(size, size)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  await writeFile(file, png);
  written.push(`${relative(root, file).replaceAll('\\', '/')} (${size}x${size})`);
}

// The master SVG is 512 units wide; render it at the target size via density so it stays crisp.
const renderMaster = (relPath, size) => out(relPath, iconSvg, size, { density: (72 * size) / 512 });

// --- PWA / web ---
await renderMaster('public/icons/icon-192.png', 192);
await renderMaster('public/icons/icon-512.png', 512);
await out('public/icons/icon-maskable-512.png', fullBleedIcon(512, 0.78), 512);
await out('public/icons/apple-touch-icon.png', fullBleedIcon(180, 0.8), 180);

// --- Android ---
const res = 'android/app/src/main/res';
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [dpi, k] of Object.entries(densities)) {
  const legacy = Math.round(48 * k);
  const adaptive = Math.round(108 * k);
  await renderMaster(`${res}/mipmap-${dpi}/ic_launcher.png`, legacy);
  await out(`${res}/mipmap-${dpi}/ic_launcher_round.png`, roundIcon(legacy), legacy);
  await out(`${res}/mipmap-${dpi}/ic_launcher_foreground.png`, adaptiveForeground(adaptive), adaptive);
  await out(`${res}/mipmap-${dpi}/ic_launcher_background.png`, adaptiveBackground(adaptive), adaptive);
  await out(`${res}/drawable-${dpi}/splash_logo.png`, splashLogo(Math.round(160 * k)), Math.round(160 * k));
}

console.log(`Generated ${written.length} images from public/icon.svg (splash background ${SPLASH_BG}):`);
for (const w of written) console.log('  ' + w);
