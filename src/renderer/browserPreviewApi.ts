import type {
  DownloadItem,
  DownloadRequest,
  DownloadSettings,
  FeedRequest,
  FeedResult,
  FeedSource,
  SubscriptionSettings,
  TwitAPI,
} from './types'

const previewDownloadStore = new Map<string, DownloadItem>()
let previewDownloadSettings: DownloadSettings = {
  downloadDirectory: null,
  maxEpisodes: 25,
  maxDiskMegabytes: 2048,
  deleteAfterListen: false,
}
let previewSubscriptions: SubscriptionSettings[] = []

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { message?: string } | T | null

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload && payload.message
      ? payload.message
      : 'The local development feed endpoint failed.'
    throw new Error(message)
  }

  return payload as T
}

// Browser UI work runs through Vite, not Electron, so the preload IPC bridge is
// unavailable. This API calls a dev-only Vite middleware that fetches and parses
// the same RSS URLs as Electron's main process. That keeps browser iteration
// honest: episode titles, dates, images, MP3 URLs, and custom feed behavior come
// from real feeds instead of canned sample data.
export const browserPreviewApi: TwitAPI = {
  getBuiltInSources: async (): Promise<FeedSource[]> => {
    const response = await fetch('/api/built-in-sources')
    return readJsonResponse<FeedSource[]>(response)
  },
  getFeed: async (request: FeedRequest): Promise<FeedResult> => {
    const response = await fetch('/api/feed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    return readJsonResponse<FeedResult>(response)
  },
  getEpisodePageText: async (url: string): Promise<string> => {
    const response = await fetch('/api/episode-page-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    })
    return readJsonResponse<string>(response)
  },
  getDownloads: async (): Promise<DownloadItem[]> => {
    return Array.from(previewDownloadStore.values())
  },
  downloadEpisode: async (request: DownloadRequest): Promise<DownloadItem> => {
    const mediaUrl = request.mediaKind === 'video' ? request.episode.videoUrl : request.episode.audioUrl
    if (!mediaUrl) {
      throw new Error(`No ${request.mediaKind} media URL is available for this episode.`)
    }

    const item: DownloadItem = {
      id: `${request.episode.guid}-${request.mediaKind}`,
      episodeGuid: request.episode.guid,
      sourceId: request.sourceId,
      sourceName: request.sourceName,
      title: request.episode.title,
      mediaKind: request.mediaKind,
      mediaUrl,
      fileName: `${request.episode.title.replace(/[^\w.-]+/g, '-').slice(0, 80)}.${request.mediaKind === 'video' ? 'mp4' : 'mp3'}`,
      filePath: null,
      status: 'available',
      progress: 1,
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      listenedAt: null,
    }
    previewDownloadStore.set(item.id, item)
    return item
  },
  deleteDownload: async (id: string): Promise<DownloadItem[]> => {
    previewDownloadStore.delete(id)
    return Array.from(previewDownloadStore.values())
  },
  markDownloadListened: async (id: string): Promise<DownloadItem[]> => {
    const item = previewDownloadStore.get(id)
    if (item) {
      previewDownloadStore.set(id, { ...item, status: 'listened', listenedAt: new Date().toISOString() })
    }
    return Array.from(previewDownloadStore.values())
  },
  revealDownload: async (): Promise<void> => undefined,
  getDownloadSettings: async (): Promise<DownloadSettings> => previewDownloadSettings,
  saveDownloadSettings: async (settings: DownloadSettings): Promise<DownloadSettings> => {
    previewDownloadSettings = settings
    return previewDownloadSettings
  },
  getSubscriptions: async (): Promise<SubscriptionSettings[]> => previewSubscriptions,
  saveSubscription: async (settings: SubscriptionSettings): Promise<SubscriptionSettings[]> => {
    previewSubscriptions = [
      ...previewSubscriptions.filter(subscription => subscription.sourceId !== settings.sourceId),
      settings,
    ]
    return previewSubscriptions
  },
  openMiniPlayer: async (): Promise<void> => undefined,
}
