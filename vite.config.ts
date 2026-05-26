import { defineConfig, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import Parser from 'rss-parser'
import { BUILT_IN_SOURCES } from './src/shared/catalog'
import type { Episode, FeedRequest, FeedResult, FeedSource, FeedSourceKind } from './src/shared/types'

type RssFeedExtensions = {
  'itunes:image'?: { href?: string }
  'itunes:author'?: string
}

type RssItemExtensions = {
  mediaContent?: Array<{ $?: { type?: string; url?: string } }>
  mediaThumbnail?: { url?: string }
  duration?: string
  itunesImage?: { href?: string }
  summary?: string
}

const parser: Parser<RssFeedExtensions, RssItemExtensions> = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail'],
      ['itunes:duration', 'duration'],
      ['itunes:image', 'itunesImage'],
      ['itunes:summary', 'summary'],
    ],
    feed: [
      ['itunes:image', 'itunes:image'],
      ['itunes:author', 'itunes:author'],
    ],
  },
} as unknown as ConstructorParameters<typeof Parser<RssFeedExtensions, RssItemExtensions>>[0])

function localRssApiPlugin() {
  return {
    name: 'dryellowgold-local-rss-api',
    configureServer(server: ViteDevServer) {
      // The plain browser cannot use Electron's preload bridge, but it should
      // still exercise real Yellowgold/Jason Howell RSS data. These local-only
      // development endpoints let Vite fetch feeds from Node so browser UI work
      // sees the same episode titles, dates, images, audio URLs, and optional
      // video URLs as Electron. Keeping the development browser honest matters
      // here because the built-in sources mix podcast RSS and direct YouTube
      // page links rather than the old DrTWiT pattern of paired network
      // audio/video feeds.
      server.middlewares.use('/api/built-in-sources', (_request, response) => {
        sendJson(response, BUILT_IN_SOURCES.map(({ id, kind, name, description, hasVideo, artworkUrl, videoPageUrl, supportUrl }) => ({
          id,
          kind,
          name,
          description,
          hasVideo,
          artworkUrl,
          videoPageUrl,
          supportUrl,
        } satisfies FeedSource)))
      })

      server.middlewares.use('/api/feed', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, { message: 'Use POST for feed requests.' }, 405)
          return
        }

        try {
          const feedRequest = await readRequestBody<FeedRequest>(request)
          sendJson(response, await loadFeedForRequest(feedRequest))
        } catch (error) {
          sendJson(response, { message: sanitizeRemoteError(error).message }, 400)
        }
      })

      server.middlewares.use('/api/episode-page-text', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, { message: 'Use POST for episode page requests.' }, 405)
          return
        }

        try {
          const payload = await readRequestBody<{ url?: string }>(request)
          const safeUrl = validateCustomFeedUrl(payload.url)
          const pageResponse = await fetch(safeUrl)
          if (!pageResponse.ok) {
            throw new Error('The episode page could not be loaded.')
          }
          sendJson(response, stripHtml(await pageResponse.text()).slice(0, 120000))
        } catch (error) {
          sendJson(response, { message: sanitizeRemoteError(error).message }, 400)
        }
      })
    },
  }
}

async function readRequestBody<T>(request: NodeJS.ReadableStream): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T
}

async function loadFeedForRequest(request: FeedRequest): Promise<FeedResult> {
  const resolvedRequest = resolveFeedRequest(request)
  const feed = await parser.parseURL(resolvedRequest.feedUrl)
  const feedImage = feed['itunes:image']?.href ?? feed.image?.url ?? null

  return {
    sourceId: resolvedRequest.sourceId,
    sourceKind: resolvedRequest.sourceKind,
    title: firstText(feed.title, 'Untitled feed'),
    description: firstText(feed.description),
    image: feedImage,
    author: firstText(feed['itunes:author']),
    updatedAt: new Date().toISOString(),
    episodes: feed.items.slice(0, 60).map(item => mapEpisode(item, feedImage)),
  }
}

function resolveFeedRequest(request: FeedRequest): {
  sourceId: string
  sourceKind: FeedSourceKind
  feedUrl: string
} {
  if (request.kind === 'builtin') {
    const source = BUILT_IN_SOURCES.find(candidate => candidate.id === request.id)
    if (!source) {
      throw new Error('The requested built-in show was not found.')
    }
    // Browser-only development has to make the same media-source decision as
    // Electron's main process. Using the shared catalog here prevents the Vite
    // preview from drifting into fake data while the user validates Yellowgold
    // podcast feeds, YouTube channel RSS, custom feeds, and global search.
    return {
      sourceId: source.id,
      sourceKind: 'builtin',
      feedUrl: request.mediaPreference === 'video' ? source.videoFeedUrl : source.feedUrl,
    }
  }

  return {
    sourceId: request.id,
    sourceKind: 'custom',
    feedUrl: validateCustomFeedUrl(request.feedUrl),
  }
}

function validateCustomFeedUrl(feedUrl: string | undefined): string {
  if (!feedUrl) {
    throw new Error('A feed URL is required.')
  }

  const parsed = new URL(feedUrl)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Feed URLs must begin with http:// or https://.')
  }
  return parsed.toString()
}

function mapEpisode(item: Parser.Item & RssItemExtensions, feedImage: string | null): Episode {
  const media = getMediaUrls(item)
  return {
    guid: firstText(item.guid, item.link, item.title, item.pubDate),
    title: firstText(item.title, 'Untitled episode'),
    description: firstText(item.summary, item.contentSnippet, item.content, 'No description was provided.'),
    pubDate: firstText(item.pubDate, item.isoDate),
    duration: normalizeEpisodeDuration(item.duration),
    thumbnail: item.mediaThumbnail?.url ?? item.itunesImage?.href ?? feedImage,
    audioUrl: media.audioUrl,
    videoUrl: media.videoUrl,
    link: firstText(item.link),
  }
}

function getMediaUrls(item: Parser.Item & RssItemExtensions): Pick<Episode, 'audioUrl' | 'videoUrl'> {
  let audioUrl: string | null = null
  let videoUrl: string | null = null

  if (item.enclosure?.url) {
    const enclosureType = item.enclosure.type ?? ''
    if (enclosureType.startsWith('video') || item.enclosure.url.endsWith('.mp4')) {
      videoUrl = item.enclosure.url
    } else {
      audioUrl = item.enclosure.url
    }
  }

  for (const media of item.mediaContent ?? []) {
    const mediaType = media.$?.type ?? ''
    const mediaUrl = media.$?.url ?? null
    if (!mediaUrl) {
      continue
    }
    if (!videoUrl && mediaType.startsWith('video')) {
      videoUrl = mediaUrl
    }
    if (!audioUrl && mediaType.startsWith('audio')) {
      audioUrl = mediaUrl
    }
  }

  return { audioUrl, videoUrl }
}

function firstText(...values: Array<string | undefined | null>): string {
  return values.find(value => typeof value === 'string' && value.trim().length > 0)?.trim() ?? ''
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// The browser-only Vite API mirrors Electron's feed normalization. Some podcast
// and YouTube-style RSS items can ship `0:00` as their duration even when the
// linked episode is usable, so local browser QA should show the same
// unknown-duration state as the desktop IPC path.
function normalizeEpisodeDuration(value: string | undefined | null): string {
  const duration = firstText(value)
  if (/^(?:0+:)?0+:00$/.test(duration)) {
    return ''
  }
  if (/^\d+$/.test(duration)) {
    return formatDurationSeconds(Number(duration))
  }
  return duration
}

function formatDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return ''
  }

  const wholeSeconds = Math.round(totalSeconds)
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const seconds = wholeSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function sanitizeRemoteError(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'The feed could not be loaded.'
  if (/invalid url/i.test(message)) {
    return new Error('The feed URL is not valid.')
  }
  if (/status code 401|status code 403/i.test(message)) {
    return new Error('The feed rejected the request. Check that the member feed URL is complete.')
  }
  if (/status code 404/i.test(message)) {
    return new Error('No feed was found at that URL.')
  }
  return new Error('The feed could not be loaded. Check the URL and try again.')
}

function sendJson(
  response: NodeJS.WritableStream & { statusCode?: number; setHeader?: (name: string, value: string) => void },
  payload: unknown,
  statusCode = 200,
): void {
  response.statusCode = statusCode
  response.setHeader?.('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}

export default defineConfig({
  plugins: [react(), localRssApiPlugin()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
