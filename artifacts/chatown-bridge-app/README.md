# Chatown Bridge

Mobile-first PWA for **live Bangla (bn) ⇄ Chinese (zh)** translation.

| Phase | Features |
|---|---|
| **1** | Local split-screen, PTT speech, TTS, typed input, IndexedDB, PWA |
| **2** | Shared rooms (6-char + QR), speaking lock, multi-participant / multi-device |
| **3** | Glossary, PDF/DOCX export, meeting summary, pinyin/romanization, offline phrasebook, Whisper endpoint stub |

**Privacy:** audio never leaves the device by default. Only text is POSTed to `/translate`. Whisper VPS is opt-in / unconfigured by default.

## Quick start

```bash
npm install
npm run dev:api    # :5001 translate + rooms
npm run dev        # :5173 UI (proxies /api → :5001)
```

Or `npm run dev:all`.

### Firebase (optional)

Set `VITE_FIREBASE_*` in `.env` and deploy Functions/Hosting. Without Firebase, **local rooms API** provides the same client contract (in-memory, multi-device via polling).

```bash
firebase deploy
# secrets: firebase functions:secrets:set GEMINI_API_KEY
```

### Providers

`TRANSLATE_PROVIDER=libre|gemini|google|nllb|mock` (server env only).

## Tests

```bash
npm run test:unit
npm test   # includes translate + rooms handler tests
```

## Scripts

| Script | Purpose |
|---|---|
| `dev` / `dev:api` / `dev:all` | Local UI + API |
| `build` | Production PWA → `dist/` |
| `test` | Node test runner |

## Folder structure

```
src/components  UI
src/lib         speech, tts, api, store, rooms, firebase, glossary, export, romanize
src/data        offline phrasebook
functions/      local-server, providers, Cloud Functions (translate)
```

## Message schema

```ts
{ id, speakerId, speakerName?, srcLang, srcText, translations:{bn,zh}, romanizations?, ts }
```

## License

Private unless otherwise stated.
