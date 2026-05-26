import { app, BrowserWindow, ipcMain, shell } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import Parser from 'rss-parser'
import { BUILT_IN_SOURCES } from '../shared/catalog'
import type {
  DownloadItem,
  DownloadRequest,
  DownloadSettings,
  Episode,
  FeedRequest,
  FeedResult,
  FeedSource,
  FeedSourceKind,
  SubscriptionSettings,
} from '../shared/types'

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

let mainWindow: BrowserWindow | null = null
let miniPlayerWindow: BrowserWindow | null = null
const downloadItems = new Map<string, DownloadItem>()
let downloadSettings: DownloadSettings = {
  downloadDirectory: null,
  maxEpisodes: 25,
  maxDiskMegabytes: 2048,
  deleteAfterListen: false,
}
let subscriptions: SubscriptionSettings[] = []

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged

// Electron owns all remote RSS loading instead of letting the renderer fetch
// feeds directly. That keeps CORS, tokenized private URLs, and parser-specific
// normalization in one trusted process boundary while the renderer receives a
// stable, display-oriented data contract.
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1040,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0d10',
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createMiniPlayerWindow(): void {
  if (miniPlayerWindow) {
    miniPlayerWindow.focus()
    return
  }

  miniPlayerWindow = new BrowserWindow({
    width: 420,
    height: 220,
    minWidth: 360,
    minHeight: 180,
    parent: mainWindow ?? undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    title: 'DrYellowgold Mini Player',
    backgroundColor: '#0b0d10',
    show: false,
  })

  miniPlayerWindow.once('ready-to-show', () => {
    miniPlayerWindow?.show()
  })

  if (isDev) {
    miniPlayerWindow.loadURL('http://localhost:5173?popout=player')
  } else {
    miniPlayerWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), { query: { popout: 'player' } })
  }

  miniPlayerWindow.on('closed', () => {
    miniPlayerWindow = null
  })
}

// Private/member RSS URLs can include bearer-like tokens in the query string or
// path. Errors returned to the renderer are therefore intentionally generic: the
// UI gets an actionable message, but neither the renderer state nor screenshots
// need to contain the full secret-bearing URL.
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

// URL validation is duplicated in the renderer for fast feedback and repeated
// here as the security boundary. The main process never trusts renderer input,
// even though the only current caller is the local app UI.
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

function validateHttpUrl(url: string | undefined, label: string): string {
  if (!url) {
    throw new Error(`${label} is required.`)
  }

  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must begin with http:// or https://.`)
  }

  return parsed.toString()
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

function getDownloadRoot(): string {
  return downloadSettings.downloadDirectory ?? path.join(app.getPath('userData'), 'Downloads')
}

function safeFileName(value: string, extension: string): string {
  const baseName = value.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'episode'
  return `${baseName}.${extension}`
}

function getDownloadItem(id: string): DownloadItem {
  const item = downloadItems.get(id)
  if (!item) {
    throw new Error('The requested download was not found.')
  }
  return item
}

// Built-in feeds are resolved by id so the renderer does not need to know their
// canonical URLs. The inherited feed contract accepts a media preference because
// DrTWiT had paired audio/video feeds; DrYellowgold keeps that contract so the
// browser preview, Electron IPC, and global search stay aligned. Yellowgold
// built-in video surfaces are now link-only in the renderer because YouTube RSS
// proved unreliable. Custom feeds carry a local URL because that is user data
// entered on this machine and persisted only in renderer localStorage; for
// custom feeds the entered URL is authoritative and may contain either audio or
// video enclosures.
function resolveFeedRequest(request: FeedRequest): {
  sourceId: string
  sourceKind: FeedSourceKind
  feedUrl: string
} {
  if (request.kind === 'builtin') {
    const builtInSource = BUILT_IN_SOURCES.find(source => source.id === request.id)
    if (!builtInSource) {
      throw new Error('The requested built-in show was not found.')
    }
    return {
      sourceId: builtInSource.id,
      sourceKind: 'builtin',
      feedUrl: request.mediaPreference === 'video' ? builtInSource.videoFeedUrl : builtInSource.feedUrl,
    }
  }

  return {
    sourceId: request.id,
    sourceKind: 'custom',
    feedUrl: validateCustomFeedUrl(request.feedUrl),
  }
}

// RSS feeds are inconsistent about optional text fields. This helper keeps the
// downstream mapping readable and guarantees the renderer sees strings instead
// of undefined values for labels, descriptions, and dates.
function firstText(...values: Array<string | undefined | null>): string {
  return values.find(value => typeof value === 'string' && value.trim().length > 0)?.trim() ?? ''
}

// Some podcast and YouTube-style RSS entries publish an explicit `0:00`
// duration even when the media or episode page is valid. Treating that as real
// metadata makes the episode table look broken, so zero-like RSS duration values
// are displayed as unknown until a media element can report runtime during
// playback.
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

// Episode mapping translates many RSS dialects into one renderer contract. The
// chosen fields deliberately favor visible UI stability: every episode gets an
// id, a title, a description, a thumbnail fallback, and explicit nullable media
// URLs so buttons can be shown only when playback is possible.
function mapEpisode(item: Parser.Item & RssItemExtensions, feedImage: string | null): Episode {
  const guid = firstText(item.guid, item.link, item.title, item.pubDate)
  const media = getMediaUrls(item)

  return {
    guid,
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

// Media selection prefers explicit MIME hints when they are available, then
// falls back to the normal podcast enclosure as audio. That matches the active
// Jason Howell podcast feeds and member/private RSS behavior without hiding
// audio-only shows behind a missing video URL.
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

ipcMain.handle('get-built-in-sources', async (): Promise<FeedSource[]> => {
  return BUILT_IN_SOURCES.map(({ id, kind, name, description, hasVideo, artworkUrl, videoPageUrl, supportUrl }) => ({
    id,
    kind,
    name,
    description,
    hasVideo,
    artworkUrl,
    videoPageUrl,
    supportUrl,
  }))
})

ipcMain.handle('get-feed', async (_event, request: FeedRequest): Promise<FeedResult> => {
  const resolvedRequest = resolveFeedRequest(request)

  try {
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
  } catch (error) {
    console.error('Feed load failed:', error instanceof Error ? error.message : 'Unknown feed error')
    throw sanitizeRemoteError(error)
  }
})

ipcMain.handle('get-episode-page-text', async (_event, url: string): Promise<string> => {
  const safeUrl = validateHttpUrl(url, 'Episode page URL')
  const response = await fetch(safeUrl)
  if (!response.ok) {
    throw new Error('The episode page could not be loaded.')
  }
  return stripHtml(await response.text()).slice(0, 120000)
})

ipcMain.handle('get-downloads', async (): Promise<DownloadItem[]> => {
  return Array.from(downloadItems.values())
})

ipcMain.handle('download-episode', async (_event, request: DownloadRequest): Promise<DownloadItem> => {
  const mediaUrl = validateHttpUrl(
    request.mediaKind === 'video' ? request.episode.videoUrl ?? undefined : request.episode.audioUrl ?? undefined,
    'Episode media URL',
  )
  const id = `${request.episode.guid}-${request.mediaKind}`
  const extension = request.mediaKind === 'video' ? 'mp4' : 'mp3'
  const downloadRoot = getDownloadRoot()
  const fileName = safeFileName(request.episode.title, extension)
  const filePath = path.join(downloadRoot, fileName)
  const startedAt = new Date().toISOString()
  const queuedItem: DownloadItem = {
    id,
    episodeGuid: request.episode.guid,
    sourceId: request.sourceId,
    sourceName: request.sourceName,
    title: request.episode.title,
    mediaKind: request.mediaKind,
    mediaUrl,
    fileName,
    filePath,
    status: 'downloading',
    progress: 0,
    error: null,
    createdAt: startedAt,
    completedAt: null,
    listenedAt: null,
  }
  downloadItems.set(id, queuedItem)

  try {
    await fs.mkdir(downloadRoot, { recursive: true })
    const response = await fetch(mediaUrl)
    if (!response.ok || !response.arrayBuffer) {
      throw new Error('The media file could not be downloaded.')
    }
    await fs.writeFile(filePath, Buffer.from(await response.arrayBuffer()))
    const completedItem = {
      ...queuedItem,
      status: 'available' as const,
      progress: 1,
      completedAt: new Date().toISOString(),
    }
    downloadItems.set(id, completedItem)
    return completedItem
  } catch (error) {
    const failedItem = {
      ...queuedItem,
      status: 'failed' as const,
      error: error instanceof Error ? error.message : 'The media file could not be downloaded.',
    }
    downloadItems.set(id, failedItem)
    return failedItem
  }
})

ipcMain.handle('delete-download', async (_event, id: string): Promise<DownloadItem[]> => {
  const item = getDownloadItem(id)
  if (item.filePath) {
    await fs.rm(item.filePath, { force: true })
  }
  downloadItems.delete(id)
  return Array.from(downloadItems.values())
})

ipcMain.handle('mark-download-listened', async (_event, id: string): Promise<DownloadItem[]> => {
  const item = getDownloadItem(id)
  const listenedItem = { ...item, status: 'listened' as const, listenedAt: new Date().toISOString() }
  downloadItems.set(id, listenedItem)
  if (downloadSettings.deleteAfterListen && listenedItem.filePath) {
    await fs.rm(listenedItem.filePath, { force: true })
    downloadItems.delete(id)
  }
  return Array.from(downloadItems.values())
})

ipcMain.handle('reveal-download', async (_event, id: string): Promise<void> => {
  const item = getDownloadItem(id)
  if (item.filePath) {
    shell.showItemInFolder(item.filePath)
  }
})

ipcMain.handle('get-download-settings', async (): Promise<DownloadSettings> => downloadSettings)

ipcMain.handle('save-download-settings', async (_event, settings: DownloadSettings): Promise<DownloadSettings> => {
  downloadSettings = settings
  return downloadSettings
})

ipcMain.handle('get-subscriptions', async (): Promise<SubscriptionSettings[]> => subscriptions)

ipcMain.handle('save-subscription', async (_event, settings: SubscriptionSettings): Promise<SubscriptionSettings[]> => {
  subscriptions = [
    ...subscriptions.filter(subscription => subscription.sourceId !== settings.sourceId),
    settings,
  ]
  return subscriptions
})

ipcMain.handle('open-mini-player', async (): Promise<void> => {
  createMiniPlayerWindow()
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
