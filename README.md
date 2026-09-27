<p align="center"><img src="public/icons/icon-192.png" width="112" alt="Outpost Surge icon"></p>

# Outpost Surge

Lead a growing squad through zombie-infested runs, pick the right gates to multiply your soldiers, then
bring the loot home to build up your outpost, recruit heroes and push back the horde.

Outpost Surge is an **original, fan-made game** inspired by the squad-runner / zombie-survival base-builder
genre. All names, characters, art (procedural low-poly, built in code) and sound (synthesized) are our own.

> Outpost Surge is not affiliated with, endorsed by, or connected to any other game, publisher or company.

## Play

| Platform | How |
|---|---|
| **Android** | Install the APK from the [latest release](https://github.com/jlrhayes/outpost-surge/releases/latest) (steps below). |
| **iPhone / iPad / any phone** | Open **https://jlrhayes.github.io/outpost-surge/** and add it to your home screen (steps below). |
| **Desktop** | Just open https://jlrhayes.github.io/outpost-surge/ in a browser. |

### Android (APK)
1. On your phone, open the [latest release](https://github.com/jlrhayes/outpost-surge/releases/latest) and
   download `OutpostSurge-<version>.apk` from **Assets**.
2. Open the downloaded file. If Android blocks it, allow your browser / file manager to
   **install unknown apps** (Settings > Apps > Special app access > Install unknown apps) and try again.
3. Tap **Install** and launch **Outpost Surge**. To update, install a newer APK over the old one; your
   progress is kept.

### iPhone and other phones (web app)
1. Open https://jlrhayes.github.io/outpost-surge/ in **Safari** (iPhone/iPad) or **Chrome** (Android).
2. Safari: tap **Share > Add to Home Screen**. Chrome: **menu > Add to Home screen / Install app**.
3. Launch it from the home screen: it runs full-screen in portrait and works offline after the first load.

## Features

<!-- The lead fills in the details as modules land. -->
- Survival Runs: steer your squad through good and bad gates, shoot barrels for upgrades, beat the boss.
- Outpost building: HQ-gated upgrades, resource producers, construction queues.
- Heroes & squads: recruit, level up, and build formations with type counters.
- Campaign & world map: auto-battle stages, zombie hordes, gathering and marches.
- _More to come..._

## Development

Requires Node.js 22+ (CI uses Node 24).

```bash
npm ci               # install
npm run dev          # dev server (http://localhost:5173, also on your LAN for phone testing)
npm run typecheck    # TypeScript check
npm run build        # production build to dist/ (includes the PWA service worker)
npm run preview      # serve dist/ locally
```

Architecture, module ownership and coding rules: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Android app (Capacitor)

The `android/` folder is a standard [Capacitor](https://capacitorjs.com/) 8 project wrapping `dist/`.

```bash
npm run android:sync   # build the web app and copy it into android/
npm run android:open   # open in Android Studio (needs JDK 21 + Android SDK)
cd android && ./gradlew assembleRelease   # APK in android/app/build/outputs/apk/release/
```

### Icons

All icons and the Android splash logo are generated from `public/icon.svg`:

```bash
npm run icons   # regenerates public/icons/*.png and android/app/src/main/res/**/ic_launcher*.png, splash_logo.png
```

## Releases & CI

| Workflow | Trigger | Result |
|---|---|---|
| `.github/workflows/pages.yml` | push to `main`, manual | Deploys the web build to GitHub Pages |
| `.github/workflows/android.yml` | push to `main`, manual | Builds the APK, uploaded as a workflow artifact |
| `.github/workflows/android.yml` | push of a tag `v*` | Same, plus a GitHub Release with the APK attached |

Cut a release:

```bash
git tag v0.1.0 && git push origin v0.1.0   # tags with a "-" (e.g. v0.2.0-beta.1) become pre-releases
```

The APK `versionName` comes from the tag (or `<package.json version>-build.<run>` for main builds) and the
`versionCode` is the workflow run number, so every build can be installed over the previous one.

### One-time repository setup

1. **Pages**: Settings > Pages > Build and deployment > Source = **GitHub Actions**.
2. **Signing key** (strongly recommended, do it before the first release): all releases must be signed with
   the same key, otherwise players have to uninstall (losing progress) to update.
   ```bash
   npm run keystore          # writes release.p12 + release.p12.b64 (gitignored), prints a password
   gh secret set ANDROID_KEYSTORE_BASE64 < release.p12.b64
   gh secret set ANDROID_KEYSTORE_PASSWORD      # paste the printed password
   gh secret set ANDROID_KEY_ALIAS --body outpostsurge
   ```
   Or add them under Settings > Secrets and variables > Actions. `ANDROID_KEY_PASSWORD` is optional (defaults
   to the keystore password). Back up `release.p12` and its password somewhere private, then delete the local
   copies. Never commit them.
   Without these secrets the workflow still succeeds but signs with a throwaway debug key (with a warning).

## License

[MIT](package.json)
