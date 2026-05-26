import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { EpisodeList } from './components/EpisodeList'
import { PlayerBar } from './components/PlayerBar'
import { ShowHeader } from './components/ShowHeader'
import { Sidebar, type AppView } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { loadCustomFeeds, saveCustomFeeds } from './feedStorage'
import { getTwitApi } from './twitApi'
import { formatEpisodeDuration } from './episodeFormatters'
import type { CustomFeedSource, DownloadItem, DownloadMediaKind, DownloadSettings, Episode, FeedResult, FeedSource, SubscriptionSettings } from './types'

type SearchMode = 'show' | 'global'

interface GlobalSearchResult {
  episode: Episode
  feed: FeedResult
  source: FeedSource
  matchType: 'show' | 'title' | 'page'
}

function App() {
  const [builtInSources, setBuiltInSources] = useState<FeedSource[]>([])
  const [customFeeds, setCustomFeeds] = useState<CustomFeedSource[]>(() => loadCustomFeeds())
  const [selectedSource, setSelectedSource] = useState<FeedSource | null>(null)
  const [feed, setFeed] = useState<FeedResult | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null)
  const [playerEpisode, setPlayerEpisode] = useState<Episode | null>(null)
  const [playerFeedTitle, setPlayerFeedTitle] = useState<string | null>(null)
  const [feedArtworkBySourceId, setFeedArtworkBySourceId] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('show')
  const [transcriptTextByEpisodeGuid, setTranscriptTextByEpisodeGuid] = useState<Record<string, string>>({})
  const [globalSearchFeedsBySourceId, setGlobalSearchFeedsBySourceId] = useState<Record<string, FeedResult>>({})
  const [globalTranscriptTextByEpisodeGuid, setGlobalTranscriptTextByEpisodeGuid] = useState<Record<string, string>>({})
  const [isTranscriptSearchLoading, setIsTranscriptSearchLoading] = useState(false)
  const [isGlobalSearchLoading, setIsGlobalSearchLoading] = useState(false)
  const [globalSearchError, setGlobalSearchError] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<'audio' | 'video'>('audio')
  const [playerMode, setPlayerMode] = useState<'audio' | 'video'>('audio')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<AppView>('shows')
  const [queuedEpisodes, setQueuedEpisodes] = useState<Episode[]>([])
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [downloadSettings, setDownloadSettings] = useState<DownloadSettings>({
    downloadDirectory: null,
    maxEpisodes: 25,
    maxDiskMegabytes: 2048,
    deleteAfterListen: false,
  })
  const [subscriptions, setSubscriptions] = useState<SubscriptionSettings[]>([])
  const [isFilterFocused, setIsFilterFocused] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMiniPlayer, setIsMiniPlayer] = useState(false)
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState('Not checked yet')

  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pendingPlaybackRequestRef = useRef(0)
  const feedRequestSequenceRef = useRef(0)
  const automaticDownloadKeysRef = useRef(new Set<string>())
  const [playbackRequestId, setPlaybackRequestId] = useState(0)
  const twitApi = useMemo(() => getTwitApi(), [])

  const allSources = useMemo(() => [...builtInSources, ...customFeeds], [builtInSources, customFeeds])
  const normalizedQuery = query.trim().toLowerCase()
  const isGlobalSearch = searchMode === 'global' && Boolean(normalizedQuery)
  const selectedSourceMatchesQuery = Boolean(normalizedQuery && (
    selectedSource?.name.toLowerCase().includes(normalizedQuery) ||
    feed?.title.toLowerCase().includes(normalizedQuery)
  ))
  const titleMatchedEpisodes = useMemo(() => {
    if (!feed || !normalizedQuery || selectedSourceMatchesQuery) {
      return []
    }
    return feed.episodes.filter(episode => episode.title.toLowerCase().includes(normalizedQuery))
  }, [feed, normalizedQuery, selectedSourceMatchesQuery])

  // Search is intentionally ordered instead of being one flat string match.
  // Source/show matches win first because the top search field is global in the
  // chrome. Episode-title matches come next because they are fast and obvious.
  // Episode-page text is last because it requires network fetches through the
  // trusted app boundary and should not hide stronger catalog/title matches.
  const filteredEpisodes = useMemo(() => {
    if (!feed || !normalizedQuery || selectedSourceMatchesQuery || isGlobalSearch) {
      return feed?.episodes ?? []
    }

    if (titleMatchedEpisodes.length > 0) {
      return titleMatchedEpisodes
    }

    return feed.episodes.filter(episode => {
      return transcriptTextByEpisodeGuid[episode.guid]?.toLowerCase().includes(normalizedQuery)
    })
  }, [feed, normalizedQuery, selectedSourceMatchesQuery, titleMatchedEpisodes, transcriptTextByEpisodeGuid, isGlobalSearch])

  // Global search has to preserve the current show browsing context while it
  // searches across every configured feed. Results are ordered to match the
  // product contract: source/show name matches first, episode title matches
  // second, and fetched episode-page text matches last. The full feed object is
  // kept with each result so selecting a global hit can immediately show and
  // play the correct episode without waiting for another RSS fetch.
  const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
    if (!isGlobalSearch) {
      return []
    }

    const showMatches: GlobalSearchResult[] = []
    const titleMatches: GlobalSearchResult[] = []
    const pageMatches: GlobalSearchResult[] = []

    for (const source of allSources) {
      const searchFeed = globalSearchFeedsBySourceId[source.id]
      if (!searchFeed) {
        continue
      }

      const sourceMatches = source.name.toLowerCase().includes(normalizedQuery) || searchFeed.title.toLowerCase().includes(normalizedQuery)
      for (const episode of searchFeed.episodes) {
        if (sourceMatches) {
          showMatches.push({ episode, feed: searchFeed, source, matchType: 'show' })
          continue
        }

        if (episode.title.toLowerCase().includes(normalizedQuery)) {
          titleMatches.push({ episode, feed: searchFeed, source, matchType: 'title' })
          continue
        }

        if (globalTranscriptTextByEpisodeGuid[episode.guid]?.toLowerCase().includes(normalizedQuery)) {
          pageMatches.push({ episode, feed: searchFeed, source, matchType: 'page' })
        }
      }
    }

    return [...showMatches, ...titleMatches, ...pageMatches].sort((left, right) => {
      return getEpisodeTimestamp(right.episode.pubDate) - getEpisodeTimestamp(left.episode.pubDate)
    })
  }, [allSources, globalSearchFeedsBySourceId, globalTranscriptTextByEpisodeGuid, isGlobalSearch, normalizedQuery])

  const selectedMediaUrl = selectedEpisode
    ? activeMode === 'video'
      ? selectedEpisode.videoUrl
      : selectedEpisode.audioUrl
    : null
  const currentMediaUrl = playerEpisode
    ? playerMode === 'video'
      ? playerEpisode.videoUrl
      : playerEpisode.audioUrl
    : null
  const topBarStatusDetail = feed
    ? `${feed.episodes.length} episodes • ${activeMode}`
    : selectedSource
      ? selectedSource.name
      : 'Choose a show'
  const selectedEpisodeQueued = Boolean(selectedEpisode && queuedEpisodes.some(episode => episode.guid === selectedEpisode.guid))
  const sidebarBuiltInSources = useMemo(() => {
    return builtInSources.map(source => ({
      ...source,
      artworkUrl: feedArtworkBySourceId[source.id] ?? source.artworkUrl ?? null,
    }))
  }, [builtInSources, feedArtworkBySourceId])
  const sidebarCustomFeeds = useMemo(() => {
    return customFeeds.map(feedSource => ({
      ...feedSource,
      artworkUrl: feedArtworkBySourceId[feedSource.id] ?? feedSource.artworkUrl ?? null,
    }))
  }, [customFeeds, feedArtworkBySourceId])

  // Startup loads only the public built-in source catalog. Custom feeds are
  // loaded synchronously from localStorage above so private URLs never need to
  // leave the device unless the user selects that feed and asks the main process
  // to fetch it.
  useEffect(() => {
    let isMounted = true

    twitApi.getBuiltInSources().then(sourceList => {
      if (!isMounted) {
        return
      }
      setBuiltInSources(sourceList)
      setSelectedSource(currentSource => currentSource ?? sourceList[0] ?? null)
    }).catch(() => {
      if (isMounted) {
        setError('Built-in shows could not be loaded.')
      }
    })

    return () => {
      isMounted = false
    }
  }, [twitApi])

  // Persisting custom feeds in one effect keeps add/remove handlers simple and
  // makes the storage behavior obvious for future migrations or a safer storage
  // backend.
  useEffect(() => {
    saveCustomFeeds(customFeeds)
  }, [customFeeds])

  useEffect(() => {
    twitApi.getDownloads().then(setDownloads).catch(() => setDownloads([]))
    twitApi.getDownloadSettings().then(setDownloadSettings).catch(() => undefined)
    twitApi.getSubscriptions().then(setSubscriptions).catch(() => setSubscriptions([]))
  }, [twitApi])

  useEffect(() => {
    if (!normalizedQuery || searchMode !== 'show') {
      return
    }

    const sourceMatch = allSources.find(source => source.name.toLowerCase().includes(normalizedQuery))
    if (sourceMatch && sourceMatch.id !== selectedSource?.id) {
      setSelectedSource(sourceMatch)
      setActiveView('shows')
    }
  }, [allSources, normalizedQuery, searchMode, selectedSource?.id])

  // Source and media-family selection are the two triggers for RSS loading. For
  // Yellowgold built-ins, Audio mode uses podcast RSS while Video mode now opens
  // the original YouTube page or playlist because YouTube's RSS endpoints proved
  // unreliable for this use case. Custom feeds still go through the RSS loader
  // in both modes because user-entered feeds may expose direct media enclosures.
  useEffect(() => {
    if (selectedSource) {
      if (selectedSource.kind === 'builtin' && selectedSource.videoPageUrl && (activeMode === 'video' || selectedSource.id === 'jason-howell-youtube')) {
        setFeed(null)
        setSelectedEpisode(null)
        setError(null)
        setIsLoading(false)
        setLastUpdatedLabel('Open video page')
        return
      }
      loadFeed(selectedSource, activeMode)
    }
  }, [selectedSource, activeMode])

  useEffect(() => {
    if (!feed) {
      return
    }
    const activeSubscription = subscriptions.find(subscription => subscription.enabled && subscription.sourceId === feed.sourceId)
    if (!activeSubscription) {
      return
    }

    for (const mediaKind of activeSubscription.mediaKinds) {
      const episode = feed.episodes.find(candidate => mediaKind === 'video' ? candidate.videoUrl : candidate.audioUrl)
      if (!episode) {
        continue
      }
      const downloadKey = `${episode.guid}-${mediaKind}`
      const alreadyDownloaded = downloads.some(download => download.id === downloadKey)
      if (alreadyDownloaded || automaticDownloadKeysRef.current.has(downloadKey)) {
        continue
      }
      automaticDownloadKeysRef.current.add(downloadKey)
      handleDownloadEpisode(episode, mediaKind).catch(() => {
        automaticDownloadKeysRef.current.delete(downloadKey)
      })
    }
  }, [feed, subscriptions, downloads])

  useEffect(() => {
    if (!feed || !normalizedQuery || searchMode !== 'show' || selectedSourceMatchesQuery || titleMatchedEpisodes.length > 0) {
      return
    }

    const episodesNeedingTranscript = feed.episodes
      .filter(episode => episode.link && !transcriptTextByEpisodeGuid[episode.guid])
      .slice(0, 12)

    if (episodesNeedingTranscript.length === 0) {
      return
    }

    let isCancelled = false
    setIsTranscriptSearchLoading(true)

    Promise.all(episodesNeedingTranscript.map(async episode => {
      try {
        const text = await twitApi.getEpisodePageText(episode.link)
        return [episode.guid, text] as const
      } catch {
        return [episode.guid, ''] as const
      }
    })).then(results => {
      if (isCancelled) {
        return
      }
      setTranscriptTextByEpisodeGuid(currentText => {
        const nextText = { ...currentText }
        for (const [guid, text] of results) {
          nextText[guid] = text
        }
        return nextText
      })
    }).finally(() => {
      if (!isCancelled) {
        setIsTranscriptSearchLoading(false)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [feed, normalizedQuery, searchMode, selectedSourceMatchesQuery, titleMatchedEpisodes.length, transcriptTextByEpisodeGuid, twitApi])

  // Global search loads RSS results for every known source into a separate cache
  // so the user's current selected show is not replaced just because they typed
  // into the top bar. Private/member URLs are still sent only through the same
  // trusted API boundary used for ordinary feed selection, and errors are kept
  // generic so tokenized feed URLs do not leak into the UI. Built-in YouTube
  // video surfaces are link-only, so global search falls back to their podcast
  // RSS instead of asking the backend to fetch broken YouTube feed URLs.
  useEffect(() => {
    if (!isGlobalSearch || allSources.length === 0) {
      setGlobalSearchError(null)
      return
    }

    const missingSources = allSources.filter(source => !globalSearchFeedsBySourceId[source.id])
    if (missingSources.length === 0) {
      return
    }

    let isCancelled = false
    setIsGlobalSearchLoading(true)
    setGlobalSearchError(null)

    Promise.all(missingSources.map(async source => {
      try {
        const searchFeed = await twitApi.getFeed({
          kind: source.kind,
          id: source.id,
          feedUrl: source.kind === 'custom' ? source.feedUrl : undefined,
          mediaPreference: source.kind === 'builtin' && source.videoPageUrl ? 'audio' : activeMode,
        })
        return { source, searchFeed }
      } catch {
        return { source, searchFeed: null }
      }
    })).then(results => {
      if (isCancelled) {
        return
      }

      const loadedFeeds = results.filter((result): result is { source: FeedSource, searchFeed: FeedResult } => Boolean(result.searchFeed))
      if (loadedFeeds.length !== results.length) {
        setGlobalSearchError('Some feeds could not be included in global search.')
      }

      setGlobalSearchFeedsBySourceId(currentFeeds => {
        const nextFeeds = { ...currentFeeds }
        for (const { source, searchFeed } of loadedFeeds) {
          nextFeeds[source.id] = searchFeed
          if (searchFeed.image) {
            setFeedArtworkBySourceId(currentArtwork => ({
              ...currentArtwork,
              [searchFeed.sourceId]: searchFeed.image ?? '',
            }))
          }
        }
        return nextFeeds
      })
    }).finally(() => {
      if (!isCancelled) {
        setIsGlobalSearchLoading(false)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [activeMode, allSources, globalSearchFeedsBySourceId, isGlobalSearch, twitApi])

  // Episode-page text search is the slowest and most network-heavy tier. Global
  // mode therefore fetches a bounded batch of pages after feed/title matches are
  // available, then enriches results as text arrives. The limit keeps the app
  // responsive while still making transcript/content search work across shows.
  useEffect(() => {
    if (!isGlobalSearch) {
      return
    }

    const titleOrShowMatchExists = globalSearchResults.some(result => result.matchType === 'show' || result.matchType === 'title')
    if (titleOrShowMatchExists) {
      return
    }

    const episodesNeedingPageText = Object.values(globalSearchFeedsBySourceId)
      .flatMap(searchFeed => searchFeed.episodes)
      .filter(episode => episode.link && !globalTranscriptTextByEpisodeGuid[episode.guid])
      .slice(0, 30)

    if (episodesNeedingPageText.length === 0) {
      return
    }

    let isCancelled = false
    setIsGlobalSearchLoading(true)

    Promise.all(episodesNeedingPageText.map(async episode => {
      try {
        const text = await twitApi.getEpisodePageText(episode.link)
        return [episode.guid, text] as const
      } catch {
        return [episode.guid, ''] as const
      }
    })).then(results => {
      if (isCancelled) {
        return
      }
      setGlobalTranscriptTextByEpisodeGuid(currentText => {
        const nextText = { ...currentText }
        for (const [guid, text] of results) {
          nextText[guid] = text
        }
        return nextText
      })
    }).finally(() => {
      if (!isCancelled) {
        setIsGlobalSearchLoading(false)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [globalSearchFeedsBySourceId, globalSearchResults, globalTranscriptTextByEpisodeGuid, isGlobalSearch, twitApi])

  // Volume has to be applied after media element swaps because switching from
  // audio to video creates a different DOM element with its own volume state.
  useEffect(() => {
    const activeMediaElement = playerMode === 'video' ? videoRef.current : audioRef.current
    if (activeMediaElement) {
      activeMediaElement.volume = volume
    }
  }, [playerMode, currentMediaUrl, volume])

  // The player has its own mode and episode, separate from the feed currently
  // being browsed. That separation is important: changing from Audio to Video in
  // the UI should not stop an already-playing audio element. Only an explicit
  // play request changes the player source, and this effect consumes that
  // request after React has mounted the matching media element.
  useLayoutEffect(() => {
    const media = activeMediaElement()
    if (media) {
      const shouldPlayRequestedEpisode = pendingPlaybackRequestRef.current === playbackRequestId && playbackRequestId > 0
      if (shouldPlayRequestedEpisode) {
        pendingPlaybackRequestRef.current = 0
        media.play().catch(() => setIsPlaying(false))
      }
    }
  }, [currentMediaUrl, playerMode, playbackRequestId])

  // Global transport shortcuts belong at the app shell level rather than on a
  // specific button because users expect media keys to work while focus is on
  // the episode list, the hero, or empty chrome. Form controls are explicitly
  // excluded so typing a search query, changing the Show/Global dropdown, or
  // editing download settings never gets hijacked by Space or arrow shortcuts.
  useEffect(() => {
    function handleKeyboardTransport(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isEditableTarget = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'))
      if (isEditableTarget) {
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        handleTogglePlayback()
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handleSkip(-10)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleSkip(10)
      }
    }

    window.addEventListener('keydown', handleKeyboardTransport)
    return () => {
      window.removeEventListener('keydown', handleKeyboardTransport)
    }
  })

  // Feed loading resets only the browsing selection. It deliberately does not
  // pause or replace the player, because browsing another show or switching
  // Audio/Video should not stop what is already playing.
  async function loadFeed(source: FeedSource, mediaPreference = activeMode) {
    const requestSequence = feedRequestSequenceRef.current + 1
    feedRequestSequenceRef.current = requestSequence
    setIsLoading(true)
    setError(null)
    setFeed(null)
    setSelectedEpisode(null)

    try {
      const feedResult = await twitApi.getFeed({
        kind: source.kind,
        id: source.id,
        feedUrl: source.kind === 'custom' ? source.feedUrl : undefined,
        mediaPreference,
      })
      if (feedRequestSequenceRef.current !== requestSequence) {
        return
      }
      setFeed(feedResult)
      setSelectedEpisode(feedResult.episodes[0] ?? null)
      if (feedResult.image) {
        setFeedArtworkBySourceId(currentArtwork => ({
          ...currentArtwork,
          [feedResult.sourceId]: feedResult.image ?? '',
        }))
      }
      setLastUpdatedLabel(new Date(feedResult.updatedAt).toLocaleString())
    } catch (caughtError) {
      if (feedRequestSequenceRef.current !== requestSequence) {
        return
      }
      setError(caughtError instanceof Error ? caughtError.message : 'The feed could not be loaded.')
    } finally {
      if (feedRequestSequenceRef.current === requestSequence) {
        setIsLoading(false)
      }
    }
  }

  // Adding a feed selects it immediately, matching the product workflow in the
  // concept: user adds a member URL, then sees whether it loads without hunting
  // for it in the source list.
  function handleAddFeed(feedSource: CustomFeedSource) {
    setCustomFeeds(currentFeeds => [...currentFeeds, feedSource])
    setSelectedSource(feedSource)
  }

  // Removal is local only. There is no cloud delete or remote unsubscribe step;
  // the app simply forgets the local URL and falls back to the first built-in
  // show if the removed feed was selected.
  function handleRemoveFeed(feedId: string) {
    setCustomFeeds(currentFeeds => currentFeeds.filter(feedSource => feedSource.id !== feedId))
    if (selectedSource?.id === feedId) {
      setSelectedSource(builtInSources[0] ?? null)
    }
  }

  // Episode selection updates the browsed row every time. It updates the actual
  // player only when the caller passes an explicit playback request, so ordinary
  // feed loads can select a row silently while row clicks and Play Latest start
  // the requested audio or video.
  function handleSelectEpisode(episode: Episode, shouldStartPlayback = false) {
    let requestedPlayerMode = activeMode
    setSelectedEpisode(episode)
    if (activeMode === 'video' && !episode.videoUrl && episode.audioUrl) {
      setActiveMode('audio')
      requestedPlayerMode = 'audio'
    }
    if (activeMode === 'audio' && !episode.audioUrl && episode.videoUrl) {
      setActiveMode('video')
      requestedPlayerMode = 'video'
    }
    if (shouldStartPlayback) {
      const nextPlaybackRequest = playbackRequestId + 1
      setPlayerEpisode(episode)
      setPlayerFeedTitle(feed?.title ?? selectedSource?.name ?? null)
      setPlayerMode(requestedPlayerMode)
      setProgress(0)
      setDuration(0)
      setIsPlaying(false)
      pendingPlaybackRequestRef.current = nextPlaybackRequest
      setPlaybackRequestId(nextPlaybackRequest)
    }
  }

  function handleSelectGlobalSearchResult(result: GlobalSearchResult) {
    const requestedPlayerMode = activeMode === 'video' && result.episode.videoUrl
      ? 'video'
      : 'audio'
    setSelectedSource(result.source)
    setFeed(result.feed)
    setSelectedEpisode(result.episode)
    setActiveView('shows')

    const nextPlaybackRequest = playbackRequestId + 1
    setPlayerEpisode(result.episode)
    setPlayerFeedTitle(result.feed.title)
    setPlayerMode(requestedPlayerMode)
    setProgress(0)
    setDuration(0)
    setIsPlaying(false)
    pendingPlaybackRequestRef.current = nextPlaybackRequest
    setPlaybackRequestId(nextPlaybackRequest)
  }

  function handlePlayLatest() {
    const latestEpisode = feed?.episodes[0]
    if (latestEpisode) {
      handleSelectEpisode(latestEpisode, true)
    }
  }

  // The queue is intentionally local in this first redesign pass. It gives the
  // previously dead "In queue" and Queue navigation controls a concrete,
  // reversible behavior without introducing background downloads, accounts, or
  // persistent library state before those flows are designed.
  function handleToggleQueue() {
    const episodeToQueue = selectedEpisode ?? feed?.episodes[0]
    if (!episodeToQueue) {
      return
    }

    setQueuedEpisodes(currentQueue => {
      if (currentQueue.some(episode => episode.guid === episodeToQueue.guid)) {
        return currentQueue.filter(episode => episode.guid !== episodeToQueue.guid)
      }
      return [episodeToQueue, ...currentQueue]
    })
    setActiveView('queue')
  }

  async function handleDownloadEpisode(episode: Episode, mediaKind: DownloadMediaKind) {
    if (!selectedSource) {
      return
    }
    const item = await twitApi.downloadEpisode({
      sourceId: selectedSource.id,
      sourceName: feed?.title ?? selectedSource.name,
      episode,
      mediaKind,
    })
    setDownloads(currentDownloads => [
      item,
      ...currentDownloads.filter(download => download.id !== item.id),
    ])
    setActiveView('downloads')
  }

  async function handleDeleteDownload(id: string) {
    setDownloads(await twitApi.deleteDownload(id))
  }

  async function handleMarkDownloadListened(id: string) {
    setDownloads(await twitApi.markDownloadListened(id))
  }

  function handleRevealDownload(id: string) {
    twitApi.revealDownload(id).catch(() => undefined)
  }

  function handleOpenMiniPlayer() {
    twitApi.openMiniPlayer().then(() => {
      setIsMiniPlayer(true)
    }).catch(() => {
      setIsMiniPlayer(currentValue => !currentValue)
    })
  }

  async function handleSaveDownloadSettings(nextSettings: DownloadSettings) {
    setDownloadSettings(await twitApi.saveDownloadSettings(nextSettings))
  }

  async function handleSubscriptionChange(mediaKinds: DownloadMediaKind[]) {
    if (!selectedSource) {
      return
    }
    const nextSubscription: SubscriptionSettings = {
      sourceId: selectedSource.id,
      sourceName: feed?.title ?? selectedSource.name,
      mediaKinds,
      enabled: mediaKinds.length > 0,
    }
    setSubscriptions(await twitApi.saveSubscription(nextSubscription))
  }

  function renderUtilityView() {
    if (activeView === 'queue') {
      return (
        <section className="utility-view">
          <h2>Queue</h2>
          {queuedEpisodes.length === 0 ? (
            <p>No queued episodes yet. Use In queue on a selected episode to add one.</p>
          ) : (
            <div className="utility-list">
              {queuedEpisodes.map(episode => (
                <button className="utility-row" type="button" key={episode.guid} onClick={() => handleSelectEpisode(episode, true)}>
                  <strong>{episode.title}</strong>
                  <span>{episode.duration || 'Duration unavailable'}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )
    }

    if (activeView === 'downloads') {
      return (
        <section className="utility-view">
          <h2>Downloads</h2>
          {downloads.length === 0 ? (
            <p>No offline episodes yet. Use the Audio or Video download buttons on an episode row to save media locally.</p>
          ) : (
            <div className="download-list">
              {downloads.map(download => (
                <article className="download-row" key={download.id}>
                  <div>
                    <strong>{download.title}</strong>
                    <span>{download.sourceName} • {download.mediaKind} • {download.status}</span>
                  </div>
                  <div className="download-actions">
                    <button type="button" onClick={() => handleRevealDownload(download.id)} disabled={!download.filePath}>Show file</button>
                    <button type="button" onClick={() => handleMarkDownloadListened(download.id)}>Mark listened</button>
                    <button type="button" onClick={() => handleDeleteDownload(download.id)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )
    }

    return (
      <section className="utility-view">
        <h2>Settings</h2>
        <div className="settings-grid">
          <label>
            <span>Playback volume</span>
            <input type="range" min="0" max="1" step="0.05" value={volume} onChange={event => setVolume(Number(event.target.value))} />
          </label>
          <label>
            <span>Default media mode</span>
            <select value={activeMode} onChange={event => handleModeChange(event.target.value as 'audio' | 'video')}>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </select>
          </label>
          <label>
            <span>Download folder</span>
            <input
              value={downloadSettings.downloadDirectory ?? ''}
              placeholder="Managed app data Downloads folder"
              onChange={event => handleSaveDownloadSettings({ ...downloadSettings, downloadDirectory: event.target.value || null })}
            />
          </label>
          <label>
            <span>Maximum downloaded episodes</span>
            <input
              type="number"
              min="1"
              value={downloadSettings.maxEpisodes}
              onChange={event => handleSaveDownloadSettings({ ...downloadSettings, maxEpisodes: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>Maximum disk use (MB)</span>
            <input
              type="number"
              min="128"
              value={downloadSettings.maxDiskMegabytes}
              onChange={event => handleSaveDownloadSettings({ ...downloadSettings, maxDiskMegabytes: Number(event.target.value) })}
            />
          </label>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={downloadSettings.deleteAfterListen}
              onChange={event => handleSaveDownloadSettings({ ...downloadSettings, deleteAfterListen: event.target.checked })}
            />
            <span>Delete after listened</span>
          </label>
        </div>
      </section>
    )
  }

  function handleModeChange(mode: 'audio' | 'video') {
    if (mode === 'video' && selectedSource?.kind === 'builtin' && selectedSource.hasVideo === false) {
      return
    }
    setActiveMode(mode)
  }

  function activeMediaElement(): HTMLAudioElement | HTMLVideoElement | null {
    if (playerMode === 'video' && playerEpisode) {
      return videoRef.current
    }
    return playerMode === 'audio' ? audioRef.current : null
  }

  function handleTogglePlayback() {
    const media = activeMediaElement()
    if (!media) {
      return
    }

    if (media.paused) {
      media.play().catch(() => setIsPlaying(false))
    } else {
      media.pause()
    }
  }

  // Clicking the video surface should behave like every modern media player:
  // start playback when the poster is showing, otherwise toggle pause/play on
  // the active player. If the visible stage is only a browsing preview, the
  // click first promotes that episode into the real player before playback.
  function handleVideoSurfaceClick(episode: Episode) {
    if (!videoStageIsActivePlayer) {
      handleSelectEpisode(episode, true)
      return
    }

    handleTogglePlayback()
  }

  function handleSkip(seconds: number) {
    const media = activeMediaElement()
    if (media) {
      media.currentTime = Math.max(0, media.currentTime + seconds)
    }
  }

  function handleSeek(percent: number) {
    const media = activeMediaElement()
    if (media && duration > 0) {
      media.currentTime = Math.min(duration, Math.max(0, duration * percent))
    }
  }

  // Fullscreen uses the most media-specific target available. In video mode the
  // video element should fill the display; in audio mode there is no visual
  // media element, so the application shell becomes the fullscreen target and
  // keeps the player controls available.
  function handleFullscreen() {
    const fullscreenTarget = videoRef.current?.closest('.video-stage') ?? videoRef.current ?? document.querySelector('.app-shell')
    const webkitTarget = fullscreenTarget as (Element & { webkitRequestFullscreen?: () => Promise<void> | void }) | null

    if (!fullscreenTarget) {
      return
    }

    const fullscreenRequest = fullscreenTarget.requestFullscreen?.() ?? webkitTarget?.webkitRequestFullscreen?.()
    Promise.resolve(fullscreenRequest).catch(() => {
      // Fullscreen can be rejected when the browser requires a stricter user
      // activation. The control is best-effort and should not disrupt playback.
    })
  }

  function handleTimeUpdate() {
    const media = activeMediaElement()
    if (media) {
      setProgress(media.currentTime)
      setDuration(Number.isFinite(media.duration) ? media.duration : 0)
    }
  }

  // The video stage must be tied to the active video player whenever video is
  // already playing. Without this derived target, changing from one feed mode to
  // another can swap the video element's src out from under the player and stop
  // playback as a side effect of browsing. When the player is not currently a
  // video, the stage can safely act as a browsing preview for the selected row.
  const videoStageEpisode = playerMode === 'video' && playerEpisode ? playerEpisode : selectedEpisode
  const videoStageMediaUrl = playerMode === 'video' && playerEpisode ? currentMediaUrl : selectedMediaUrl
  const videoStageIsActivePlayer = Boolean(playerMode === 'video' && playerEpisode && videoStageEpisode?.guid === playerEpisode.guid)
  const shouldRenderVideoStage = Boolean(videoStageEpisode?.videoUrl && videoStageMediaUrl && activeMode === 'video')
  const selectedVideoPageUrl = selectedSource?.kind === 'builtin' && (activeMode === 'video' || selectedSource.id === 'jason-howell-youtube')
    ? selectedSource.videoPageUrl
    : undefined

  return (
    <div className={`app-shell ${isMiniPlayer ? 'player-mini' : ''}`}>
      <Sidebar
        sources={sidebarBuiltInSources}
        customFeeds={sidebarCustomFeeds}
        selectedSourceId={selectedSource?.id ?? null}
        lastUpdatedLabel={lastUpdatedLabel}
        activeView={activeView}
        queueCount={queuedEpisodes.length}
        downloadCount={downloads.length}
        onSelectView={setActiveView}
        onSelectSource={setSelectedSource}
        onAddFeed={handleAddFeed}
        onRemoveFeed={handleRemoveFeed}
      />

      <main className="workspace">
        <TopBar
          query={query}
          searchMode={searchMode}
          isLoading={isLoading}
          statusLabel={error ? 'Needs Attention' : 'All Up to Date'}
          statusDetail={isGlobalSearch ? `${globalSearchResults.length} global matches` : error ?? topBarStatusDetail}
          onQueryChange={setQuery}
          onSearchModeChange={setSearchMode}
          onRefresh={() => selectedSource && loadFeed(selectedSource)}
          onFocusSearch={() => setIsFilterFocused(true)}
          onFilter={() => setIsFilterFocused(current => !current)}
        />

        <div className="content-region">
          {activeView === 'shows' ? (
            <>
              {isFilterFocused && (
                <div className="filter-banner">
                  {isGlobalSearch ? 'Global search is checking all configured feeds.' : 'Search is filtering the current episode list.'}
                  {isTranscriptSearchLoading || isGlobalSearchLoading ? ' Checking episode pages.' : ''}
                  {globalSearchError ? ` ${globalSearchError}` : ''}
                  <button type="button" onClick={() => setQuery('')}>Clear search</button>
                </div>
              )}
              {shouldRenderVideoStage && videoStageEpisode && videoStageMediaUrl && (
                <section className={`video-stage player-video-stage ${activeMode === 'audio' ? 'preserved-player' : ''}`}>
                  <video
                    ref={videoRef}
                    src={videoStageMediaUrl}
                    poster={videoStageEpisode.thumbnail ?? undefined}
                    onClick={() => handleVideoSurfaceClick(videoStageEpisode)}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />
                  {(!videoStageIsActivePlayer || !isPlaying) && (
                    <button className="video-overlay-play" type="button" onClick={() => handleSelectEpisode(videoStageEpisode, true)}>
                      <span>▶</span>
                    </button>
                  )}
                  <div className="video-stage-tools" aria-label="Video window controls">
                    <button type="button" aria-label="Skip back 10 seconds" onClick={() => handleSkip(-10)}>
                      ↶10
                    </button>
                    <button type="button" aria-label={isPlaying ? 'Pause video' : 'Play video'} onClick={() => handleVideoSurfaceClick(videoStageEpisode)}>
                      {isPlaying && videoStageIsActivePlayer ? 'Pause' : 'Play'}
                    </button>
                    <button type="button" aria-label="Skip forward 10 seconds" onClick={() => handleSkip(10)}>
                      10↷
                    </button>
                    <button type="button" onClick={handleOpenMiniPlayer}>
                      Mini
                    </button>
                    <button type="button" aria-label="Fullscreen video" onClick={handleFullscreen}>
                      ⛶
                    </button>
                  </div>
                </section>
              )}
              <ShowHeader
                feed={feed}
                selectedSource={selectedSource}
                selectedEpisode={selectedEpisode}
                activeMode={activeMode}
                isQueued={selectedEpisodeQueued}
                onPlayLatest={handlePlayLatest}
                onToggleQueue={handleToggleQueue}
                onModeChange={handleModeChange}
                onRefresh={() => selectedSource && !selectedVideoPageUrl && loadFeed(selectedSource, activeMode)}
              />
              {selectedSource && (
                <div className="subscription-panel">
                  <span>Auto-download this feed</span>
                  {(['audio', 'video'] as DownloadMediaKind[]).map(mediaKind => {
                    const currentSubscription = subscriptions.find(subscription => subscription.sourceId === selectedSource.id)
                    const checked = Boolean(currentSubscription?.mediaKinds.includes(mediaKind))
                    return (
                      <label key={mediaKind}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => {
                            const existingKinds = currentSubscription?.mediaKinds ?? []
                            const nextKinds = event.target.checked
                              ? [...new Set([...existingKinds, mediaKind])]
                              : existingKinds.filter(kind => kind !== mediaKind)
                            handleSubscriptionChange(nextKinds)
                          }}
                        />
                        {mediaKind}
                      </label>
                    )
                  })}
                </div>
              )}
              {selectedVideoPageUrl ? (
                <section className="utility-view video-link-view">
                  <h2>Open video source</h2>
                  <p>YouTube RSS is not reliable for this source. Use the original page or playlist for videos.</p>
                  <a className="primary-button external-video-link" href={selectedVideoPageUrl} target="_blank" rel="noreferrer">
                    Open {selectedSource?.name}
                  </a>
                </section>
              ) : isGlobalSearch ? (
                <GlobalSearchResults
                  results={globalSearchResults}
                  isLoading={isGlobalSearchLoading}
                  query={query}
                  selectedEpisode={selectedEpisode}
                  onSelectResult={handleSelectGlobalSearchResult}
                />
              ) : (
                <EpisodeList
                  episodes={filteredEpisodes}
                  selectedEpisode={selectedEpisode}
                  isLoading={isLoading}
                  error={error}
                  onSelectEpisode={episode => handleSelectEpisode(episode, true)}
                  onDownloadEpisode={handleDownloadEpisode}
                />
              )}
            </>
          ) : renderUtilityView()}
        </div>
      </main>

      {playerEpisode?.audioUrl && playerMode === 'audio' && currentMediaUrl && (
        <audio
          ref={audioRef}
          src={currentMediaUrl}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      <PlayerBar
        episode={playerEpisode ?? selectedEpisode}
        feedTitle={playerEpisode ? playerFeedTitle : feed?.title ?? null}
        activeMode={playerMode}
        isPlaying={isPlaying}
        isMiniPlayer={isMiniPlayer}
        progress={progress}
        duration={duration}
        volume={volume}
        onTogglePlayback={handleTogglePlayback}
        onToggleMiniPlayer={handleOpenMiniPlayer}
        onFullscreen={handleFullscreen}
        onSkip={handleSkip}
        onSeek={handleSeek}
        onVolumeChange={setVolume}
      />
    </div>
  )
}

function GlobalSearchResults({ results, isLoading, query, selectedEpisode, onSelectResult }: {
  results: GlobalSearchResult[]
  isLoading: boolean
  query: string
  selectedEpisode: Episode | null
  onSelectResult: (result: GlobalSearchResult) => void
}) {
  if (isLoading && results.length === 0) {
    return (
      <div className="empty-state">
        <div className="loading-ring" />
        <strong>Searching all shows</strong>
        <span>Loading RSS feeds for global results.</span>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="empty-state">
        <strong>No global matches</strong>
        <span>{query.trim() ? 'Try a different show, episode, or transcript term.' : 'Enter a search term.'}</span>
      </div>
    )
  }

  return (
    <section className="global-search-results" aria-label="Global search results">
      <div className="global-search-head">
        <span>{results.length} matches across all shows</span>
        {isLoading && <small>Checking more episode pages…</small>}
      </div>
      <div className="episode-rows">
        {results.map(result => (
          <button
            className={`episode-row global-result ${selectedEpisode?.guid === result.episode.guid ? 'selected' : ''}`}
            key={`${result.source.id}-${result.episode.guid}-${result.matchType}`}
            type="button"
            onClick={() => onSelectResult(result)}
          >
            <span className="row-play">{selectedEpisode?.guid === result.episode.guid ? '●' : '▶'}</span>
            <span className="episode-main">
              <strong>{result.episode.title}</strong>
              <small>{result.feed.title} • {describeGlobalMatch(result.matchType)}</small>
            </span>
            <span className="episode-date">{formatDate(result.episode.pubDate)}</span>
            <span className="episode-duration">{formatEpisodeDuration(result.episode.duration)}</span>
            <span className="episode-media">{result.episode.videoUrl ? 'Video' : result.episode.audioUrl ? 'Audio' : '—'}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function describeGlobalMatch(matchType: GlobalSearchResult['matchType']): string {
  if (matchType === 'show') {
    return 'show match'
  }
  if (matchType === 'title') {
    return 'episode title match'
  }
  return 'episode page match'
}

function formatDate(value: string): string {
  if (!value) {
    return '—'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getEpisodeTimestamp(value: string): number {
  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime()
}

export default App
