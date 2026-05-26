import type { CustomFeedSource } from './types'

const CUSTOM_FEEDS_STORAGE_KEY = 'dryellowgold.customFeeds.v1'

// Custom/member feed URLs are user-entered local data and may contain tokens.
// They are persisted only in this Electron renderer's localStorage so v1 avoids
// introducing accounts, cloud sync, or Keychain behavior before those security
// and UX decisions are explicitly designed.
export function loadCustomFeeds(): CustomFeedSource[] {
  const rawValue = window.localStorage.getItem(CUSTOM_FEEDS_STORAGE_KEY)
  if (!rawValue) {
    return []
  }

  try {
    const parsedValue = JSON.parse(rawValue) as CustomFeedSource[]
    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue.filter(isStoredCustomFeed)
  } catch {
    return []
  }
}

// The storage writer keeps the complete URL because RSS member feeds commonly
// encode access in the URL itself. UI code must use safeFeedLabel when it needs
// to display a feed identifier so screenshots and errors do not expose tokens.
export function saveCustomFeeds(feeds: CustomFeedSource[]): void {
  window.localStorage.setItem(CUSTOM_FEEDS_STORAGE_KEY, JSON.stringify(feeds))
}

// Feed creation centralizes id generation, URL normalization, and default
// naming. That prevents the form component from duplicating persistence rules
// and makes future migrations easier if localStorage needs a v2 schema.
export function createCustomFeed(name: string, feedUrl: string): CustomFeedSource {
  const normalizedUrl = normalizeFeedUrl(feedUrl)
  return {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'custom',
    name: name.trim() || hostnameFromUrl(normalizedUrl),
    description: 'Private RSS feed saved on this device',
    feedUrl: normalizedUrl,
    createdAt: new Date().toISOString(),
  }
}

// Renderer-side validation is for immediate user feedback. The main process
// repeats the same protocol check before fetching because renderer validation is
// not a trust boundary.
export function normalizeFeedUrl(feedUrl: string): string {
  let parsedUrl: URL

  // URL parsing throws browser-specific exception text for malformed input.
  // Convert that into stable product copy here so the add-feed form can show a
  // useful error without leaking implementation details or token-bearing input.
  try {
    parsedUrl = new URL(feedUrl.trim())
  } catch {
    throw new Error('Feed URLs must start with http:// or https://.')
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Feed URLs must start with http:// or https://.')
  }
  return parsedUrl.toString()
}

// This label deliberately omits the query string and fragment. Tokenized member
// feed URLs often put credentials there, and the visual UI should never reveal
// those secrets casually.
export function safeFeedLabel(feedUrl: string): string {
  try {
    const parsedUrl = new URL(feedUrl)
    return `${parsedUrl.hostname}${parsedUrl.pathname}`
  } catch {
    return 'Private feed'
  }
}

function hostnameFromUrl(feedUrl: string): string {
  try {
    return new URL(feedUrl).hostname.replace(/^www\./, '')
  } catch {
    return 'Private feed'
  }
}

function isStoredCustomFeed(value: CustomFeedSource): value is CustomFeedSource {
  return (
    value?.kind === 'custom' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.feedUrl === 'string' &&
    typeof value.createdAt === 'string'
  )
}
