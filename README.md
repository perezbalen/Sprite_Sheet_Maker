# SpriteLoop

SpriteLoop is a desktop app that turns video clips into curated sprite frames. It lets you loop a range, mark specific frames, chroma-key backgrounds, crop away empty padding, and export PNG sequences, animated GIFs, and sprite sheets.

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

## Workflow

1. Drop an MP4 onto the app or click “Open Video...”.
2. Scrub to the section you want and set IN/OUT points.
3. Mark frames manually or auto-mark every N frames within IN/OUT.
4. Preview the selected frames loop and adjust preview FPS.
5. Use chroma key + crop to remove the background and trim extra space.
6. Export PNG frames, an animated GIF, or a sprite sheet.

## Features and usage

### Video playback + frame accuracy

- **Playback FPS** controls the playback rate and the frame counter. Use it when the video’s frame rate is known or when you want precise frame stepping.
- **Frame field** lets you type an exact frame number.
- **Loop IN→OUT Preview** loops the playback between your IN and OUT points.

### Marking frames

- **Mark Current Frame** adds the current frame to the list and extracts it via ffmpeg.
- **Mark every N frames** (within IN/OUT) adds evenly spaced frames and includes both endpoints.
- The **Marked Frames** list is draggable to reorder the animation sequence.

### Selected Frames Preview

- **Play/Stop** toggles the preview loop.
- **Preview FPS** controls the loop speed for the selected frames only.
- **Zoom** lets you inspect pixels more precisely for color picking.

### Chroma key

- **Pick Key Color** samples exact pixels from the preview.
- **Tolerance** expands the keyed range around picked colors.
- **Feather** softens edges; **Feather Direction** can bias toward background or subject.
- **Choke / Edge Thickness** shrinks the matte to remove halos.
- **Smoothing / Edge Blend** further softens edges after feathering.
- **Preview Background** lets you load a test image behind the transparency.

### Crop

- **Top / Right / Bottom / Left** crop values (px) trim transparent or empty space.
- Crop is **non-destructive** in preview and applied only to exports.

### Export

- **PNG Frames**: exports each marked frame as an RGBA PNG.
- **Animated GIF**: exports a GIF at the chosen GIF FPS.
- **Sprite Sheet**: choose Columns/Rows/Padding; alpha is preserved.

## Keyboard shortcuts

- `←` / `→`: Step one frame backward/forward. (the player must not be selected)
- `↓` or `Enter`: Mark current frame.

## How frame extraction works

- On video import, SpriteLoop creates a unique job folder under your OS temp directory (`<temp>/spriteloop/job_*`).
- It extracts frames with a bundled `ffmpeg-static` binary (falls back to system `ffmpeg` if present) using the current playback timestamp.
- Extracted PNGs are stored in the job folder and reused if the same timestamp is marked again.
- On app start, old jobs are cleaned up (retains the last 5).
