---
name: Capacitor WebView fixes
description: Root causes of broken buttons/events in Android WebView + mobile SPA architecture
---

## Problem 1 — TanStack Start SSR shell breaks all events
`__root.tsx` with `shellComponent` renders `<html><head><body>` inside `<div id="root">`. Browser normalises this invalid DOM → React loses all event handlers.
**Fix:** Separate SPA entry: `index.mobile.html` → `main.mobile.tsx` → `router.mobile.ts` → `routes.mobile/` directory. Root has NO `shellComponent`, `HeadContent`, or `Scripts`.

## Problem 2 — window.prompt/confirm suppressed
Android WebView silently returns `null`/`false` for `window.prompt()` and `window.confirm()`.
**Fix:** Replace with React inline inputs + sonner toast confirmations everywhere.

## Problem 3 — Monaco editor broken in WebView
Monaco requires web workers and `require()` polyfill — both break in Capacitor WebView.
**Fix:** Replaced with `@uiw/react-codemirror` (CodeMirror 6) — mobile-friendly, works in WebView.

## dist must contain index.html
Capacitor `cap sync` requires `dist/index.html`. Vite with `rollupOptions.input: "index.mobile.html"` outputs `dist/index.mobile.html`. Add a rename step in CI:
```
mv dist/index.mobile.html dist/index.html
```

## API key security
Never use `VITE_*` env vars for secrets — they are bundled into client JS and extractable from APK. User must enter their OpenAI sk-*** key once in the app's Copilot settings screen; stored only in localStorage (zustand persist).
