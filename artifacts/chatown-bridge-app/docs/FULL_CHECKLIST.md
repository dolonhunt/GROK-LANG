# Full app checklist

## Phase 1
| Case | Result |
|---|---|
| Typed bn→zh / zh→bn | PASS |
| Cache + rate limit | PASS |
| PWA build | PASS |
| Unit tests | PASS 12/12 |

## Phase 2
| Case | Result |
|---|---|
| Create/join room | PASS (API E2E) |
| Live message <3s | PASS ~0.7s |
| Speaking lock | PASS |
| QR + link | CODE (QRCodeCard) |
| Firebase path | CODE (lazy; needs project) |

## Phase 3
| Case | Result |
|---|---|
| Glossary UI | CODE |
| Export PDF/DOCX | CODE (lazy) |
| Summary | CODE |
| Romanization toggle | CODE |
| Phrasebook offline | CODE |
| Whisper | STUB (privacy-safe) |

## Known issues
1. Free MT may 429 — chain falls to gtx/mock
2. Firebase deploy not run in this environment
3. Bundle still large when export/firebase chunks load
4. npm install on artifacts FS may fail (use /tmp)
5. Multi-device room poll interval 800ms (local); Firestore is realtime
