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
Quest Browser has no Web Speech API, so the demo uses on-device **Vosk** (WebAssembly, about 40 MB model, downloaded once
from the public vosk-browser host) with a small grammar of sound-alikes. Desktop Chrome/Edge use the browser's speech API.
Force on-device mode with `?voice=vosk`. Add `?lowfx` to turn shadows off on weaker devices.

## Notes
- This repo holds only text files: binary assets (textures, model) are stored as base64 and unpacked in the browser
  (`src/boot.js`). The Vosk model and `vosk.js` are loaded from public CDNs.
- No logos or trademarked art. Not affiliated with any rights holder. See [CREDITS.md](CREDITS.md) for asset licenses.
