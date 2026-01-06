# Product Requirements Document (PRD)

## 1. Overview

SpriteLoop is a desktop application for converting video clips into curated sprite frames with chroma keying and export to individual PNGs and sprite sheets. It targets Windows 10/11 first and aims to be cross-platform (macOS/Linux) via Electron.

## 2. Goals

- Provide accurate frame marking and extraction from video playback.
- Enable a focused selected-frames preview loop with adjustable FPS.
- Offer chroma key tools (dropper, tolerance, feather) for transparent exports.
- Export keyed frames as individual PNGs and as a single sprite sheet PNG.
- Keep the UI single-window, simple, and functional.

## 3. Non-Goals

- Cloud services or remote processing.
- Video editing beyond marking frames and setting IN/OUT.
- Batch processing multiple videos in one session.
- Advanced animation tools or timeline editing.

## 4. Target Users

- Indie game developers and animators who need fast sprite extraction.
- Artists working with AI-generated clips (Sora, Grok, etc.).
- Anyone needing manual frame curation and quick sprite sheet export.

## 5. User Stories

- As a user, I can drag and drop an MP4 and play it back.
- As a user, I can set IN/OUT points and preview that loop.
- As a user, I can mark frames and preview only those frames in a loop.
- As a user, I can chroma-key the background with a color dropper.
- As a user, I can export keyed frames and a sprite sheet PNG.

## 6. Functional Requirements

### 6.1 Video Import and Playback

- Drag/drop zone and "Open Video..." button.
- Accept MP4 files.
- Video player with play/pause, scrub bar, and current time display.
- Display current frame number (derived from FPS estimate).

### 6.2 IN/OUT Points + Loop Preview

- Buttons: "Set IN" and "Set OUT".
- Toggle: "Loop IN→OUT Preview".
- When enabled and IN/OUT set, playback loops between those points.

### 6.3 Frame Marking and Extraction

- Button: "Mark Current Frame".
- Maintain ordered list of marked frames with thumbnails and timestamps.
- Each list item has a Remove button.
- Extract frames via ffmpeg into a unique temp job folder.
- Avoid duplicate extraction for identical timestamps.

### 6.4 Selected-Frames Preview

- Canvas-based preview that loops only marked frames.
- Control: "Preview FPS" (integer input).
- Preview updates immediately on mark/remove.

### 6.5 Chroma Key

- Dropper tool to pick exact colors from preview.
- Key Colors list with swatches and remove option.
- Controls: Tolerance and Feather (px).
- Preview transparency over:
  - Checkerboard background (default).
  - Optional user-selected background image.
- Keyed transparency applies to preview and exports.

### 6.6 Export

- "Export PNG Frames..." choose folder.
- "Export Sprite Sheet..." choose file path.
- Sprite sheet options:
  - Columns (default: number of frames).
  - Padding (default: 0).
- Exported filenames: `frame_0001.png`, `frame_0002.png`, etc.
- Sprite sheet must preserve alpha and use row-major order.

### 6.7 Temp Storage and Retention

- Store extracted frames in OS temp under `spriteloop/job_*`.
- Keep last 5 jobs; clean older jobs on app start.

## 7. Quality Requirements

- Accurate frame extraction aligned with playback position.
- Responsive preview updates for frame list and chroma key changes.
- Performance acceptable for ~8-24 frames and 512-1024px wide frames.
- Exports maintain transparency fidelity.

## 8. UX Requirements

- Single-window layout with sections: Top (import + player), Middle (frames + preview), Chroma Key, Export.
- Minimal styling; functional UI.
- Clear button labels matching user story.

## 9. Technical Requirements

- Stack: Electron + React + TypeScript + Vite.
- Use bundled `ffmpeg-static` or fallback to system ffmpeg.
- OS: Windows 10/11 first; support macOS/Linux where possible.
- No cloud services.

## 10. Data Flow

1. User imports MP4.
2. App creates a temp job folder.
3. User marks frames; ffmpeg extracts PNGs to job folder.
4. Marked frames are cached and used for preview.
5. Chroma key modifies alpha mask for preview/export.
6. Exports write PNGs or sprite sheet to user path.

## 11. Dependencies

- Electron runtime
- ffmpeg-static
- React, TypeScript, Vite

## 12. Risks and Mitigations

- Frame accuracy variance across codecs.
  - Mitigation: use ffmpeg `-ss` aligned with playback timestamp and avoid re-extraction.
- Performance for large frames.
  - Mitigation: cache processed frames and use lightweight blur for feather.
- File path handling on Windows/macOS/Linux.
  - Mitigation: normalize file URLs and use Electron dialogs for exports.

## 13. Metrics / Success Criteria

- User can import video, mark frames, and export within a single session.
- Exports have transparent background when chroma key is applied.
- Preview updates within 200ms after changes.

## 14. Out of Scope (Future Ideas)

- Timeline-based editing.
- Batch video processing.
- Advanced color spill suppression.
- Export to GIF or other formats.
