# DrYellowgold

DrYellowgold is a desktop app for browsing, downloading, searching, and playing current Jason Howell and Yellowgold Studios shows.

It is built with Electron, React, Vite, TypeScript, and RSS feeds. The app uses a dark broadcast-library style interface with real show artwork, RSS-backed podcast episode lists, private feed support, offline-download planning, direct YouTube source links, and a persistent player rail.

The goal is simple: open the app, pick a show, play podcast audio when RSS media is available, and jump directly to the right YouTube page or playlist for video.

## What DrYellowgold Is For

DrYellowgold is meant to be a comfortable desktop home for Jason Howell's current shows:

- Browse AI Inside, Techsploder, Android Faithful, and Jason Howell sources.
- Load recent podcast episodes with artwork, dates, durations, descriptions, and media links when the feeds provide them.
- Open the right original YouTube page or playlist for each show's video surface.
- Add private RSS feed URLs locally on your own machine.
- Search across show/source names, episode titles, and episode page text.
- Queue episodes and use the persistent playback rail.
- Download available podcast media where the selected feed exposes direct media URLs.

Former or inactive shows are intentionally not built into the app. That excludes TWiT-era shows, All About Android, old Club TWiT AI Inside beta feeds, and guest appearances unless the catalog policy changes.

## Current Status

DrYellowgold is in active development. Expect sharp edges.

The current project focus is getting the app right in local browser development before treating Electron packaging as final. The app can be installed, tested, and packaged by developers, but the catalog and player experience are still moving.

### Features

Current local-development features include:

- A current Jason Howell source list with AI Inside, Techsploder, Android Faithful, and Jason Howell.
- Audio-mode podcast RSS loading for AI Inside, Techsploder, and Android Faithful.
- Link-only video mode for YouTube sources because YouTube RSS validation failed for these shows.
- Real show and feed artwork in the sidebar and hero areas, with fallback art only when no feed image is available.
- Local private RSS URL support, stored on the device instead of in the repository.
- Search across show/source names, episode titles, and episode page text.
- Audio playback controls with a persistent player rail.
- Queue, downloads, subscription controls, retention settings, and a managed app-data download location; real filesystem behavior still requires Electron QA.
- Browser-first local UI development with Electron reserved for child-window, managed-download, show-in-folder, and desktop integration testing.

### Built-In Sources

- AI Inside audio: `https://feeds.megaphone.fm/aiinsideshow`
- AI Inside video page: `https://www.youtube.com/@aiinsideshow/videos`
- Techsploder audio: `https://feeds.acast.com/public/shows/66231b9b6556260012ad3257`
- Techsploder video page: `https://www.youtube.com/@JasonHowell/videos`
- Android Faithful audio: `https://feeds.acast.com/public/shows/649f5be290e2100011cf6c40`
- Android Faithful video playlist: `https://www.youtube.com/playlist?list=PLHN12N7TXUyfvNb0GyYVUVus_B4GjgDWj`
- Jason Howell: `https://www.youtube.com/@JasonHowell/videos`

## Build It Yourself With An AI Agent

Use one of the following Markdown blocks as a complete prompt for Claude Code, OpenAI Codex, or another local coding agent. Pick the block for your operating system.

### macOS

````markdown
# Build DrYellowgold on macOS

You are helping me build DrYellowgold from source on macOS. Work carefully, show the commands you run, and stop with the exact error if any step fails.

## Goal

Download the DrYellowgold source code from GitHub, install the required developer tools, install project dependencies, run verification checks, run the app locally, and create a macOS package only after the local checks pass.

## Repository

Use this repository:

https://github.com/DrLehman/DrYellowgold.git

## Rules

- Do not invent package scripts. Read `package.json` before running project commands.
- Do not commit, push, or open a pull request.
- Do not paste secrets, tokens, passwords, or private RSS URLs into logs.
- If a command asks for an administrator password, pause and tell me why it is needed.
- If Homebrew, Node.js, npm, or Git are already installed, use the existing install instead of reinstalling.

## Steps

1. Confirm this is macOS:

   ```bash
   sw_vers
   uname -m
   ```

2. Confirm Apple command line tools are installed. If this fails, install them and wait for the installer to finish:

   ```bash
   xcode-select -p
   ```

   If needed:

   ```bash
   xcode-select --install
   ```

3. Confirm Git is available:

   ```bash
   git --version
   ```

4. Install Homebrew only if `brew` is missing:

   ```bash
   command -v brew
   ```

   If Homebrew is missing, install it from the official installer:

   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

   After installation, follow Homebrew's printed shell setup instructions, then verify:

   ```bash
   brew --version
   ```

5. Install Node.js only if `node` or `npm` is missing. Prefer the current LTS release:

   ```bash
   command -v node
   command -v npm
   ```

   If either command is missing:

   ```bash
   brew install node
   ```

6. Verify Node.js and npm:

   ```bash
   node --version
   npm --version
   ```

7. Choose a working folder, clone the source, and enter the project:

   ```bash
   mkdir -p "$HOME/Developer"
   cd "$HOME/Developer"
   git clone https://github.com/DrLehman/DrYellowgold.git
   cd DrYellowgold
   ```

8. Inspect available scripts before running them:

   ```bash
   npm pkg get scripts
   ```

9. Install exact project dependencies from the lockfile:

   ```bash
   npm ci
   ```

10. Run TypeScript verification:

   ```bash
   npm run typecheck
   ```

11. Run the browser app locally for manual testing:

   ```bash
   npm run dev
   ```

   Confirm the app opens, shows DrYellowgold sources, loads podcast episodes in Audio mode, and opens the correct YouTube page or playlist in Video mode.

12. Run the Electron app locally for desktop-specific testing:

   ```bash
   npm run dev:desktop
   ```

   Confirm the desktop shell opens and the same RSS/custom-feed behavior works before attempting packaging.

13. Only after `npm ci`, `npm run typecheck`, browser testing, and Electron testing pass, create a macOS package using the script that exists in `package.json`. Start with:

   ```bash
   npm run package:mac
   ```

   If the project provides a more specific macOS script such as `package:mac:dmg`, `package:mac:arm64`, or `package:mac:x64`, use the one that matches the desired output and machine architecture.

14. Report:

   - macOS version
   - CPU architecture
   - Node.js version
   - npm version
   - exact package script used
   - output folder and artifact names
   - any errors or warnings
````

### Windows

````markdown
# Build DrYellowgold on Windows

You are helping me build DrYellowgold from source on Windows. Work carefully, show the commands you run, and stop with the exact error if any step fails.

## Goal

Download the DrYellowgold source code from GitHub, install the required developer tools, install project dependencies, run verification checks, run the app locally, and create a Windows package only after the local checks pass.

## Repository

Use this repository:

https://github.com/DrLehman/DrYellowgold.git

## Rules

- Use PowerShell unless a command explicitly requires another shell.
- Do not invent package scripts. Read `package.json` before running project commands.
- Do not commit, push, or open a pull request.
- Do not paste secrets, tokens, passwords, or private RSS URLs into logs.
- If a command requires administrator permission, pause and tell me why it is needed.
- If Git, Node.js, npm, or winget are already installed, use the existing install instead of reinstalling.

## Steps

1. Confirm this is Windows and record the version:

   ```powershell
   Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, OsHardwareAbstractionLayer
   ```

2. Confirm `winget` is available:

   ```powershell
   winget --version
   ```

   If `winget` is missing, stop and tell me to install or update App Installer from the Microsoft Store.

3. Confirm Git is available:

   ```powershell
   git --version
   ```

   If Git is missing:

   ```powershell
   winget install --id Git.Git -e
   ```

   Open a new PowerShell window after installation, then verify:

   ```powershell
   git --version
   ```

4. Confirm Node.js and npm are available:

   ```powershell
   node --version
   npm --version
   ```

   If Node.js or npm is missing, install the current LTS release:

   ```powershell
   winget install --id OpenJS.NodeJS.LTS -e
   ```

   Open a new PowerShell window after installation, then verify:

   ```powershell
   node --version
   npm --version
   ```

5. Choose a working folder, clone the source, and enter the project:

   ```powershell
   New-Item -ItemType Directory -Force -Path "$HOME\Developer" | Out-Null
   Set-Location "$HOME\Developer"
   git clone https://github.com/DrLehman/DrYellowgold.git
   Set-Location "$HOME\Developer\DrYellowgold"
   ```

6. Inspect available scripts before running them:

   ```powershell
   npm pkg get scripts
   ```

7. Install exact project dependencies from the lockfile:

   ```powershell
   npm ci
   ```

8. Run TypeScript verification:

   ```powershell
   npm run typecheck
   ```

9. Run the browser app locally for manual testing:

   ```powershell
   npm run dev
   ```

   Confirm the app opens, shows DrYellowgold sources, loads podcast episodes in Audio mode, and opens the correct YouTube page or playlist in Video mode.

10. Run the Electron app locally for desktop-specific testing:

    ```powershell
    npm run dev:desktop
    ```

    Confirm the desktop shell opens and the same RSS/custom-feed behavior works before attempting packaging.

11. Only after `npm ci`, `npm run typecheck`, browser testing, and Electron testing pass, create a Windows package using the Windows package script that exists in `package.json`.

    First inspect the scripts again:

    ```powershell
    npm pkg get scripts
    ```

    Then run the Windows packaging script if one is present. Common Electron projects use a script such as:

    ```powershell
    npm run package
    ```

    If the project has a more specific Windows script, use that exact script instead.

12. Report:

    - Windows version
    - Node.js version
    - npm version
    - exact package script used
    - output folder and artifact names
    - any errors or warnings
````

## Project Notes

- The canonical project roadmap and working memory live in `scaffold.MD`.
- Private RSS URLs are local app data. They are not account credentials, not synced, and not stored in this repository.
- YouTube video sources are direct page or playlist links, not RSS-backed episode feeds.
- Generated folders such as `node_modules/`, `dist/`, and `release/` are intentionally ignored.
