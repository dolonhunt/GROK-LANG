# Phase 1 status — Chatown Bridge

**Date:** 2026-11-20  
**Status:** COMPLETE — ready for review before Phase 2

## Delivered

- Mobile-first split-screen local mode (top 中文 flipped 180°, bottom বাংলা)
- Push-to-talk (bn-BD / zh-CN), typed input, auto-play TTS toggle
- Transcript with original + translation; IndexedDB persistence; Clear
- PWA (manifest, icons, service worker, offline shell)
- `POST /translate` local server + Cloud Functions source
- Providers: libre chain (LibreTranslate → MyMemory → gtx → mock) | gemini | google | nllb
- Cache sha256(from|to|text), rate limit 30/min
- Unit + handler tests (11/11 pass)
- No audio leaves the device

## Run (local)

```bash
cd chatown-bridge-app   # or /tmp/chatown-bridge during this session
npm install
# terminal A
npm run dev:api
# terminal B
npm run dev
# http://localhost:5173
```

Dev API: `http://127.0.0.1:5001`  
Vite proxies `/api/*` → API.

## Known issues

1. **Free providers** — public LibreTranslate/MyMemory often 429; gtx + mock phrasebook fill the gap. For production set `GEMINI_API_KEY` or self-host Libre/NLLB.
2. **Speech & TTS** — quality depends on OS/browser voices (bn especially). Missing voice → notice, text still works.
3. **Mic tests** — not runnable headless; require real device + user gesture.
4. **Firebase** — Functions/Hosting deploy not run here (needs your Firebase project + secrets).
5. **Symlinks on artifacts FS** — `npm install` may fail with EPERM on `/workspace/artifacts`; install under `/tmp` or a symlink-friendly volume.
6. **“你好” reverse mock** — if only mock path hits, reverse dict maps 你好↔হ্যালো; gtx is preferred when reachable.

## Wait for go-ahead before Phase 2 (shared rooms).
