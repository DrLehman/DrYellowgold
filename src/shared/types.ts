export type FeedSourceKind = 'builtin' | 'custom'

export interface FeedSource {
  id: string
  kind: FeedSourceKind
  name: string
  description?: string
  feedUrl?: string
  hasVideo?: boolean
  artworkUrl?: string | null
  videoPageUrl?: string
  supportUrl?: string
}

export interface CustomFeedSource extends FeedSource {
  kind: 'custom'
  feedUrl: string
  createdAt: string
}

export interface Episode {
  guid: string
  title: string
  description: string
  pubDate: string
  duration: string
  thumbnail: string | null
  audioUrl: string | null
  videoUrl: string | null
  link: string
}

export interface FeedResult {
  sourceId: string
  sourceKind: FeedSourceKind
  title: string
  description: string
  image: string | null
  author: string
  updatedAt: string
  episodes: Episode[]
}

export interface FeedRequest {
  kind: FeedSourceKind
  id: string
  feedUrl?: string
  mediaPreference?: 'audio' | 'video'
}

export type DownloadMediaKind = 'audio' | 'video'
export type DownloadStatus = 'queued' | 'downloading' | 'available' | 'failed' | 'listened'

export interface DownloadItem {
  id: string
  episodeGuid: string
  sourceId: string
  sourceName: string
  title: string
  mediaKind: DownloadMediaKind
  mediaUrl: string
  fileName: string
  filePath: string | null
  status: DownloadStatus
  progress: number
  error: string | null
  createdAt: string
  completedAt: string | null
  listenedAt: string | null
}

export interface DownloadRequest {
  sourceId: string
  sourceName: string
  episode: Episode
  mediaKind: DownloadMediaKind
}

export interface DownloadSettings {
  downloadDirectory: string | null
  maxEpisodes: number
  maxDiskMegabytes: number
  deleteAfterListen: boolean
}

export interface SubscriptionSettings {
  sourceId: string
  sourceName: string
  mediaKinds: DownloadMediaKind[]
  enabled: boolean
}

export interface TwitAPI {
  getBuiltInSources: () => Promise<FeedSource[]>
  getFeed: (request: FeedRequest) => Promise<FeedResult>
  getEpisodePageText: (url: string) => Promise<string>
  getDownloads: () => Promise<DownloadItem[]>
  downloadEpisode: (request: DownloadRequest) => Promise<DownloadItem>
  deleteDownload: (id: string) => Promise<DownloadItem[]>
  markDownloadListened: (id: string) => Promise<DownloadItem[]>
  revealDownload: (id: string) => Promise<void>
  getDownloadSettings: () => Promise<DownloadSettings>
  saveDownloadSettings: (settings: DownloadSettings) => Promise<DownloadSettings>
  getSubscriptions: () => Promise<SubscriptionSettings[]>
  saveSubscription: (settings: SubscriptionSettings) => Promise<SubscriptionSettings[]>
  openMiniPlayer: () => Promise<void>
}
