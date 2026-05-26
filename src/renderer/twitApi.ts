import { browserPreviewApi } from './browserPreviewApi'
import type { TwitAPI } from './types'

// Electron injects window.twit through the preload bridge. The fallback exists
// only for local browser QA against the Vite dev server, where there is no
// Electron context but we still need to verify layout, filtering, local custom
// feed persistence, and playback controls against the same TypeScript contract.
export function getTwitApi(): TwitAPI {
  return window.twit ?? browserPreviewApi
}
