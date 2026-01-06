# SpriteLoop

SpriteLoop is a desktop app for turning video clips into curated sprite frames with chroma keying and export to PNGs or sprite sheets.

## Install

```bash
npm install
```

## Run in development

```bash
npm run dev
```

## Build (local bundles)

```bash
npm run build
```

This produces the Electron main/preload and renderer bundles under `dist/`.

## Package (installers)

```bash
npm run package
```

Electron Builder writes platform installers to `release/`.

## How frame extraction works

- On video import, SpriteLoop creates a unique job folder under your OS temp directory (`<temp>/spriteloop/job_*`).
- It extracts frames with a bundled `ffmpeg-static` binary (falls back to system `ffmpeg` if present) using the current playback timestamp.
- Extracted PNGs are stored in the job folder and reused if the same timestamp is marked again.
- On app start, old jobs are cleaned up (retains the last 5).

## Keyboard shortcuts

- `←` / `→`: Step one frame backward/forward.
- `↓` or `Enter`: Mark current frame.
