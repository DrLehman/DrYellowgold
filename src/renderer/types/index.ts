export type {
  CustomFeedSource,
  DownloadItem,
  DownloadMediaKind,
  DownloadRequest,
  DownloadSettings,
  Episode,
  FeedRequest,
  FeedResult,
  FeedSource,
  FeedSourceKind,
  SubscriptionSettings,
  TwitAPI,
} from '../../shared/types'

import type { TwitAPI } from '../../shared/types'

declare global {
  interface Window {
    twit: TwitAPI
  }
}
