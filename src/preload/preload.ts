import { contextBridge, ipcRenderer } from 'electron'
import type { FeedRequest, FeedResult, FeedSource, TwitAPI } from '../shared/types'

// The preload bridge is intentionally tiny: it exposes typed request methods
// but does not leak ipcRenderer to React. That keeps the renderer constrained to
// the app's feed contract while the main process remains responsible for remote
// network access and RSS parsing.
const api: TwitAPI = {
  getBuiltInSources: () => ipcRenderer.invoke('get-built-in-sources') as Promise<FeedSource[]>,
  getFeed: (request: FeedRequest) => ipcRenderer.invoke('get-feed', request) as Promise<FeedResult>,
  getEpisodePageText: (url: string) => ipcRenderer.invoke('get-episode-page-text', url) as Promise<string>,
  getDownloads: () => ipcRenderer.invoke('get-downloads') as ReturnType<TwitAPI['getDownloads']>,
  downloadEpisode: request => ipcRenderer.invoke('download-episode', request) as ReturnType<TwitAPI['downloadEpisode']>,
  deleteDownload: id => ipcRenderer.invoke('delete-download', id) as ReturnType<TwitAPI['deleteDownload']>,
  markDownloadListened: id => ipcRenderer.invoke('mark-download-listened', id) as ReturnType<TwitAPI['markDownloadListened']>,
  revealDownload: id => ipcRenderer.invoke('reveal-download', id) as ReturnType<TwitAPI['revealDownload']>,
  getDownloadSettings: () => ipcRenderer.invoke('get-download-settings') as ReturnType<TwitAPI['getDownloadSettings']>,
  saveDownloadSettings: settings => ipcRenderer.invoke('save-download-settings', settings) as ReturnType<TwitAPI['saveDownloadSettings']>,
  getSubscriptions: () => ipcRenderer.invoke('get-subscriptions') as ReturnType<TwitAPI['getSubscriptions']>,
  saveSubscription: settings => ipcRenderer.invoke('save-subscription', settings) as ReturnType<TwitAPI['saveSubscription']>,
  openMiniPlayer: () => ipcRenderer.invoke('open-mini-player') as ReturnType<TwitAPI['openMiniPlayer']>,
}

contextBridge.exposeInMainWorld('twit', api)
