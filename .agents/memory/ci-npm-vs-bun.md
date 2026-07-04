---
name: CI package install — bun vs npm
description: bun install fails in GitHub Actions for new packages; npm install is reliable
---

## Problem
`bun install` (with or without `--frozen-lockfile`) fails in GitHub Actions with `ConnectionRefused` / `FailedToOpenSocket` errors when the lockfile includes packages added locally in Replit. Bun's socket-based download mechanism doesn't work in the CI network environment for new tarballs.

## Fix
Use `npm install --legacy-peer-deps` for the install step. Bun is still used for running scripts (`bun run build:mobile`, `bunx cap sync`).

**Why:** npm uses standard HTTP/HTTPS downloads that work everywhere. Bun's IPC socket approach fails intermittently in GitHub Actions runners.
