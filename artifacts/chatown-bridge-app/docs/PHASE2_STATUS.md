# Phase 2 status — Shared rooms

**Status:** COMPLETE

## Delivered
- Create room → 6-char code + QR (+ `?room=CODE` link)
- Join by code / link; name + language; optional Speaker N label
- Local rooms API (in-memory) when Firebase not configured
- Firebase Auth anonymous + Firestore path when `VITE_FIREBASE_*` set
- Speaking lock: "X is speaking…", blocks overlap
- Messages fill bn+zh translations once via cache/provider
- Max 10 participants; 30-day TTL fields
- Local → Shared upgrade via Share / Rooms (same UI chrome)

## E2E (local API)
```
create room → join 2nd device → message bn→zh in ~0.7s
parts=2 msgs=1 zh=谢谢 speaking cleared after message
```

## Tests
rooms API unit test: PASS
