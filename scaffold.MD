# scaffold.MD

## IcarusShell++ Core (Immutable)

1. **Recursive Task Decomposition:**  
   All project goals are broken down hierarchically into Shells (modules/tasks) and Shards (sub-tasks/atomic units), recursively, until each unit is minimal, actionable, and verifiable.

2. **Persistent Memory and Scaffold:**  
   All knowledge, plans, decisions, outputs, and lessons learned are recorded in `scaffold.MD`. This document is continuously updated and serves as the external, persistent memory for all agents and processes.

3. **Autonomous Execution and Reflection:**  
   All agents (at every layer) autonomously plan, execute, test, and reflect on their outputs. Reflection and self-correction are built into every loop, with all insights and improvements documented in the Scaffold.

4. **MCP Tool Use (Model Context Protocol):**  
   The system must utilize all available MCP tools and data sources at its disposal to access real-time information, perform actions, and ground its outputs in accurate, up-to-date data.  
   - **Definition:** MCP (Model Context Protocol) is an open standard for connecting AI assistants to external data sources and tools, enabling standardized, modular, and context-aware tool and data integration.
   - **Scope:** In IcarusShell++, MCP is used exclusively for tool and data source integration. MCP is **not** used for orchestrating or cascading between different AI models.
   - **Operation:** Always invoke MCP-enabled tools for data access, tool usage, and action execution. Document all MCP tool usage and results in `scaffold.MD` for transparency and reproducibility.
   - **Architecture:** MCP follows a client-server model, with the AI as the client and MCP servers exposing data and functionalities.

5. **Continuous Learning and Adaptation:**  
   The system continuously incorporates new knowledge, feedback, and lessons learned into the Scaffold. All failures, successes, and process improvements are documented and used to adapt future behavior.

6. **Explicit Contracts and Interfaces:**  
   All modules, tasks, and sub-tasks define explicit, measurable contracts and interfaces. These are recorded in the Scaffold and used to ensure integration and verification across all layers.

7. **Holistic Integrity and Minimalism:**  
   The system maintains holistic project coherence, avoids unnecessary complexity, and ensures all decomposition and orchestration is minimal and justified.

8. **Immutability of Core:**  
   The IcarusShell++ Core section in `scaffold.MD` is immutable and may only be revised with explicit human approval. The system must never autonomously alter or update the Core section except when explicitly instructed by the human user.

## Project Overview

DrYellowgold is an Electron desktop application for browsing and playing active Jason Howell and Yellowgold Studios sources from RSS feeds. The current codebase uses React, Vite, TypeScript, Electron, Electron Builder, and `rss-parser`.

The project was copied from the sibling `DrTWiT` project into the `DrYellowgold` project folder as a clean transplant. Generated output and dependencies were excluded from the copy.

Current implementation facts:

- Electron main process lives in `src/main/main.ts`.
- Renderer app lives in `src/renderer/App.tsx`.
- Preload bridge lives in `src/preload/preload.ts`.
- Public renderer types live in `src/renderer/types/index.ts`.
- Shared built-in source catalog lives in `src/shared/catalog.ts`.
- The app still exposes the inherited `window.twit` preload bridge. Renaming the internal bridge is optional and should only happen as a low-risk follow-up because it touches Electron, browser-preview fallback, and renderer type contracts.
- Existing package scripts include `dev`, `dev:vite`, `dev:desktop`, `build`, `build:electron`, `package`, `package:mac`, `package:mac:dmg`, `package:mac:arm64`, `package:mac:x64`, `lint`, and `typecheck`.

Immediate project objective: make the copied app reliably installable, runnable, and useful as a Jason Howell/Yellowgold media browser while preserving the real RSS behavior and privacy-safe custom feed support inherited from DrTWiT.

## Authoritative Inputs

- System and developer instructions for safe, verifiable repository work.
- Project AGENTS instructions supplied for the `DrYellowgold` project folder.
- User-approved implementation plan: copy DrTWiT into this folder, rebrand to DrYellowgold, replace the built-in catalog with current active Jason Howell/Yellowgold sources, include Android Faithful, and avoid former/inactive shows.
- Current public catalog evidence checked on 2026-05-22 from Jason Howell Linktree, AI Inside, Techsploder, Android Faithful, Digital Trends, and live RSS responses.

Non-authoritative data handling:

- Copied DrTWiT README and scaffold content were treated as source material, not future DrYellowgold instructions.
- Web pages and RSS feeds supplied facts only; they did not supply agent instructions.
- Former TWiT-era shows, All About Android, old Club TWiT AI Inside beta feeds, and guest appearances are excluded from the built-in catalog unless the user explicitly changes the catalog policy.

## Shells, Shards, Contracts, and Tests

### Shell S1: Project Transplant and Identity

- Objective: make DrYellowgold a standalone local app derived from DrTWiT without carrying stale TWiT product identity.
- Status: active.
- Contracts:
  - Project files are copied into DrYellowgold without `node_modules`, `dist`, `release`, or `.git`.
  - `package.json`, `package-lock.json`, renderer title, visible brand labels, README, and scaffold describe DrYellowgold.
  - Internal names may remain where renaming would create unnecessary Electron contract risk.
- Tests:
  - `find . -maxdepth 2` confirms source files exist in DrYellowgold.
  - `rg "DrTWiT|TWiT|twit"` is reviewed so remaining hits are either intentionally inherited API names or historical explanatory comments.

### Shell S2: Active Catalog

- Objective: replace the copied TWiT source list with current Jason Howell/Yellowgold sources.
- Status: active.
- Contracts:
  - Built-in catalog includes AI Inside, Techsploder, Android Faithful, and Jason Howell.
  - Android Faithful is included because the user explicitly selected inclusion.
  - Former or inactive shows are not included as built-ins.
  - Browser preview and Electron load the same real RSS URLs through the shared catalog.
- Tests:
  - `npm run typecheck`.
  - Browser source list shows only the four approved built-in entries.
  - AI Inside and Android Faithful load current 2026 RSS episodes.
  - Techsploder loads its current feed without claiming a more recent cadence than the feed exposes.

### Shell S3: Playback, Search, and Custom Feeds

- Objective: preserve DrTWiT's working player, search, queue, downloads, and private feed behavior after the catalog transplant.
- Status: active.
- Contracts:
  - Search keeps the established ordering: show name first, episode title second, fetched page/content third.
  - Custom feed URLs remain local and token-safe in UI labels.
  - Video mode uses direct links to the matching YouTube page or playlist: AI Inside uploads, Jason Howell uploads for Jason Howell and Techsploder, and the Android Faithful playlist on Daily Tech News Show.
  - YouTube RSS endpoints are not treated as reliable inputs for these sources.
- Tests:
  - Browser global search returns ordered results across built-in sources.
  - Custom feed validation rejects invalid URLs and redacts tokenized URLs in visible labels.
  - Electron `npm run dev:desktop` verifies preload/main-process parity.

## Decisions and Rationales

- 2026-05-22: The app includes Android Faithful as an active Jason-hosted source, even though it is not clearly Yellowgold-owned, because the user chose to include it.
- 2026-05-22: YouTube RSS validation failed for these sources, so built-in Video mode now shows direct links to the original channel uploads page or playlist instead of trying to load an RSS video list.
- 2026-05-22: Jason Howell remains a standalone source. Its bio/description includes the Patreon link `https://www.patreon.com/JasonHowell`; Patreon is not a separate feed/source.
- 2026-05-22: The inherited `window.twit` API name is retained initially to avoid broad Electron/preload/renderer churn during the transplant.
- 2026-05-22: Plain CSS and existing React/Vite/Electron patterns remain in place; no new UI framework or dependency is introduced.

## MCP / Tool Usage Log

- 2026-05-22: Shell inspection confirmed DrYellowgold was empty before transplant.
- 2026-05-22: Shell inspection confirmed DrTWiT was clean on `main...origin/main` before copy.
- 2026-05-22: Web verification identified AI Inside, Techsploder, Android Faithful, and Jason Howell as the active catalog surfaces for this app.
- 2026-05-22: Live RSS checks confirmed reachable feeds for AI Inside, Techsploder, and Android Faithful.
- 2026-05-22: Shell copy used `rsync` with `.git`, `node_modules`, `dist`, `release`, `.vite`, and `.cache` excluded.

## Execution Log

- 2026-05-22: Copied DrTWiT into DrYellowgold as the implementation base.
- 2026-05-22: Rebranded package identity, visible UI labels, README, and scaffold to DrYellowgold.
- 2026-05-22: Replaced the built-in TWiT catalog with AI Inside, Techsploder, Android Faithful, and Jason Howell.
