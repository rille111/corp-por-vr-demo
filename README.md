# Corp Por: voice casting prototype (WebXR)

Unofficial fan concept prototype. Speak the words of power, aim with your hand, and an energy bolt strikes a daemon.
Runs in the Meta Quest 3 browser (immersive VR) and in desktop Chrome or Edge.

**Play:** https://rille111.github.io/corp-por-vr-demo/

## How to play
- **Meta Quest 3**: open the link in Meta Quest Browser, tap *Enter VR*, allow the microphone.
  Hold the **trigger**, aim at the daemon and say **"Corp Por"**. A/X casts without voice, B/Y casts **"Vas Flam"**.
  Left stick moves, right stick snap-turns.
- **Desktop**: *Enter on desktop*, click to look around. Hold **Space** (or right mouse) and say "Corp Por".
  `1` = Corp Por without voice, `2` = Vas Flam, `WASD` moves.
- If the daemon's fire hits you while you are casting, the spell fizzles.

## Voice
Nothing to install. Two recognizers run side by side and the first one that hears a spell casts it:
1. **On-device Vosk** (WebAssembly, small English model, about 41 MB). It downloads once on the first visit and is kept in
   the browser (IndexedDB), so later visits start in a second or two and work offline. It only listens for the spell words,
   which makes it robust to accents. Works in Chrome, Edge, Firefox, Safari and Meta Quest Browser.
2. **Browser speech** (Web Speech API in Chrome, Edge, Safari) as a fallback while Vosk loads.
Whatever is heard goes through a sound-alike matcher, so "car", "core", "corpse", "copper" or "core poor" all cast Corp Por,
and "was flame" or "boss flame" casts Vas Flam. The bubble shows what was heard and what it was matched to.
Options: `?voice=vosk` (only on-device), `?voice=web` (only browser speech), `?lang=sv-SE` (browser speech language).
Add `?lowfx` to turn shadows off on weaker devices.

## Notes
- This repo holds only text files: binary assets (textures, model) are stored as base64 and unpacked in the browser
  (`src/boot.js`). The Vosk model and `vosk.js` are loaded from public CDNs.
- No logos or trademarked art. Not affiliated with any rights holder. See [CREDITS.md](CREDITS.md) for asset licenses.
