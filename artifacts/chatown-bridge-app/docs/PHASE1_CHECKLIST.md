# Phase 1 test checklist

| # | Case | How | Expected | Result |
|---|---|---|---|---|
| 1 | Typed bn → zh | POST `/translate` ধন্যবাদ | 谢谢, ≤4s | **PASS** ~0.9s |
| 2 | Typed zh → bn | 你好 | Bangla translation | **PASS** ~0.3s |
| 3 | Mic bn | Hold green mic | Interim → final → translate | **MANUAL** (needs browser + mic) |
| 4 | Mic zh | Hold red mic (top, flipped) | Same for Chinese | **MANUAL** |
| 5 | Mic denied | Block permission | Toast + typed fallback | **CODE** handled in speech.ts |
| 6 | Unsupported SR | No SpeechRecognition | Banner + typed input | **CODE** isSpeechSupported |
| 7 | Auto-play off | Toggle | No TTS | **CODE** |
| 8 | Clear transcript | Clear button | IndexedDB empty | **CODE** store.clearMessages |
| 9 | Offline shell | PWA build | sw.js + precache 13 entries | **PASS** build generates SW |
| 10 | 360px width | CSS flex split | No overflow | **CODE** mobile-first Tailwind |
| 11 | No audio upload | Network | Only JSON `/translate` | **PASS** by design |
| 12 | Rate limit | 31 req/min | 429 | **PASS** unit test |
| 13 | Cache hit | Same text twice | `cached: true` | **PASS** |
| 14 | Unit tests | `npm test` | all green | **PASS** 11/11 |
| 15 | Production build | `npm run build` | dist + PWA | **PASS** |

## Automated verification (2026-11-20)

```
npm run test:unit  → 7/7 pass
npm test           → 11/11 pass
npm run build      → ok (241 kB JS gzip 76 kB)
curl bn→zh ধন্যবাদ → {"translation":"谢谢",…} <1s
Vite proxy /api/translate → works
```

## Privacy

- SpeechRecognition is browser/vendor; we never upload audio blobs.
- Only POST `{text, from, to}` JSON to `/translate`.
