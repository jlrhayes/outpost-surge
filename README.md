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

**Special Ops squad runs.** Drag to steer a crowd of soldiers down a zombie-infested road while they fire
automatically. Pick blue `+`/`×` gates and dodge red `−`/`÷` ones. Every bullet that hits a gate raises its
number, so a red gate can be shot until it turns blue. Crack barrels and crates for soldiers, weapon upgrades,
fire rate and helper vehicles. Survive sprinters, brutes, spitters and lane hazards, then take down a boss.
There are 48 levels in 6 chapters, and surviving soldiers join your army.

**Outpost building.**
- Upgrade the Command Post, which caps every other building and needs two specific buildings at the level
  below. Around it are farms, quarries, refineries, barracks, parade yards, hospitals, a research lab,
  type-specialist workshops and more.
- Upgrades are timed with builder queues, a free-finish window, speed-ups and AI ally helps.
- Tap bubbles to collect production.
- Every building has three visual upgrade tiers.

**District campaign.** A ring of zombie-held city blocks surrounds your base. Clear them one at a time in
auto-battles to unlock land and features. Every 5th district is a boss, and a loot truck gathers idle rewards.

**Heroes and squads.**
- 24 original heroes with procedurally generated portraits, in three types (tank, aircraft, missile) and
  three rarities (SR, SSR, UR).
- Each hero has three skills and four gear slots, and can gain levels (capped by the Command Post) and stars
  (from shards).
- Recruit with tickets or diamonds. There is a pity counter and duplicates become shards.
- Five-slot formations (2 front, 3 back) with a same-type bonus. The counter triangle (tank > missile >
  aircraft > tank) matters against typed bosses and rivals.
- Heroes lead soldiers of tiers T1–T10 that you train, heal and lose.

**World map.**
- A procedurally generated wasteland with zombie hordes by level, resource tiles and rival outposts that grow
  and sometimes raid you.
- Marches travel in real time, and battle reports come with replays.
- Stamina with free refills, a radar mission board, and shields.

**Guidance and goals.**
- Chapter quests with a pointing-hand tutorial and a "Go" button.
- Daily tasks with activity chests.
- A 24-node research tree.
- A welcome-back summary and a single headline **Power** number.

**Made for phones.**
- Portrait, touch-first, safe-area aware.
- Works offline, autosaves, and progresses while you're away.
- Android back button support.
- Automatic graphics-quality detection.
- About 350 KB gzipped, with no external assets: all models, icons and sounds are generated in code.

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
   Without these secrets, `main` builds still succeed (signed with a throwaway debug key, with a warning), but
   tagged releases fail on purpose so an update can never ship with a different key.

## License

[MIT](package.json)
