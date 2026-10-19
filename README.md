# CardForge Desktop — MVP 0.1.0

Offline-first desktop app starter for designing board-game cards on Windows.

## Features in this first MVP
- Card size presets: Poker (63×88 mm), Tarot (70×120 mm), Mini (44×67 mm), Square (80×80 mm), plus custom dimensions.
- SVG card canvas with selectable, draggable text, rectangle frames, and images.
- Inspector for text, font size, text color, position, frame fill and stroke.
- Local project save/open as `.cardforge.json`; imported images are embedded as data URLs in the project file.
- PNG and SVG export.
- Tauri 2 shell configuration for Windows MSI/NSIS packaging.

## Requirements
- Node.js 20+ and npm
- Rust stable toolchain
- On Windows, Microsoft C++ Build Tools and WebView2 Runtime (usually already present on Windows 11)

## Run as a web-based development preview
```powershell
npm install
npm run dev
```
Open the local URL printed by Vite. This preview runs locally and does not need a cloud service. The app uses system fonts and does not make network requests for fonts or assets.

## Run the Windows desktop shell
```powershell
npm install
npm run tauri dev
```

## Build installer
```powershell
npm install
npm run tauri build
```
Installer artifacts are produced under `src-tauri/target/release/bundle/`.

## Current MVP limitations
- The media library is currently project-scoped: imported assets are embedded in each project rather than indexed in a global reusable library.
- Text uses a basic single-line SVG text node. Rich text, font selection, resize handles, rotation, undo/redo, PDF export, bleed/crop marks, and print sheets are planned next.
- This package is a source project, not a precompiled Windows installer. Build it on a Windows PC with the prerequisites above.
