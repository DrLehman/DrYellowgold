import { useEffect, useRef, useState } from 'react'
import type { Episode, FeedResult, FeedSource } from '../types'

interface ShowHeaderProps {
  feed: FeedResult | null
  selectedSource: FeedSource | null
  selectedEpisode: Episode | null
  activeMode: 'audio' | 'video'
  isQueued: boolean
  onPlayLatest: () => void
  onToggleQueue: () => void
  onModeChange: (mode: 'audio' | 'video') => void
  onRefresh: () => void
}

export function ShowHeader({
  feed,
  selectedSource,
  selectedEpisode,
  activeMode,
  isQueued,
  onPlayLatest,
  onToggleQueue,
  onModeChange,
  onRefresh,
}: ShowHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [copiedLabel, setCopiedLabel] = useState('Copy episode link')
  const menuRef = useRef<HTMLDivElement>(null)
  const image = feed?.image ?? selectedSource?.artworkUrl
  const title = feed?.title ?? selectedSource?.name ?? 'DrYellowgold'
  // Built-in Yellowgold sources have intentionally curated bios because raw RSS
  // feed descriptions are not always the right product copy for this app. The
  // Android Faithful feed, for example, currently emits an HTML-heavy Acast
  // description that omits Jason Howell from the hero text even though this app
  // includes the show by user decision as part of Jason's active hosted work.
  // Custom/private feeds do not have a curated catalog entry, so they still use
  // the feed description after stripping any HTML that an RSS provider includes.
  const description = cleanDescription(
    selectedSource?.kind === 'builtin'
      ? selectedSource.description || feed?.description
      : feed?.description || selectedSource?.description,
  ) || 'Select a show or add a private RSS feed.'
  const primaryEpisode = selectedEpisode ?? feed?.episodes[0] ?? null
  const hasEpisodeLink = Boolean(primaryEpisode?.link)

  // The menu is intentionally local to the header because it only exposes
  // source/episode actions for the currently visible show. Closing on outside
  // click prevents the ellipsis from feeling like a dead decorative control.
  useEffect(() => {
    function handleOutsidePointer(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsidePointer)
    return () => document.removeEventListener('mousedown', handleOutsidePointer)
  }, [])

  // Episode links are public show-page URLs in built-in feeds and may be
  // member/private links for custom feeds. Copying is only triggered by a user
  // click and never exposes the underlying feed URL or tokenized RSS URL.
  async function handleCopyEpisodeLink() {
    if (!primaryEpisode?.link) {
      return
    }

    await navigator.clipboard.writeText(primaryEpisode.link)
    setCopiedLabel('Copied')
    window.setTimeout(() => setCopiedLabel('Copy episode link'), 1600)
  }

  // Opening the episode page goes through the browser/window open path instead
  // of navigating the app itself, preserving the single-screen player state.
  function handleOpenEpisodePage() {
    if (primaryEpisode?.link) {
      window.open(primaryEpisode.link, '_blank', 'noopener,noreferrer')
      setIsMenuOpen(false)
    }
  }

  return (
    <section className="show-header">
      <div className="show-art-frame">
        {image ? (
          <img src={image} alt="" />
        ) : (
          <div className="show-art-placeholder">
            <span>TECH</span>
            <strong>RSS</strong>
          </div>
        )}
      </div>

      <div className="show-copy">
        {feed?.sourceKind === 'custom' && <div className="show-kicker">Local private feed</div>}
        <h1>{title}</h1>
        <p>{description}</p>
        {selectedSource?.supportUrl && (
          <a className="support-link" href={selectedSource.supportUrl} target="_blank" rel="noreferrer">
            Support on Patreon
          </a>
        )}
        <div className="header-actions">
          <button className="primary-button play-latest" type="button" onClick={onPlayLatest} disabled={!primaryEpisode}>
            Play latest
          </button>
          <button className="secondary-button" type="button" onClick={onToggleQueue} disabled={!primaryEpisode}>
            {isQueued ? 'Queued' : 'In queue'}
          </button>
          <div className="action-menu-wrap" ref={menuRef}>
            <button
              className="icon-button"
              type="button"
              aria-label="More actions"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen(current => !current)}
            >
              ⋯
            </button>
            {isMenuOpen && (
              <div className="action-menu" role="menu">
                <button type="button" role="menuitem" onClick={onRefresh}>
                  Refresh feed
                </button>
                <button type="button" role="menuitem" onClick={handleCopyEpisodeLink} disabled={!hasEpisodeLink}>
                  {copiedLabel}
                </button>
                <button type="button" role="menuitem" onClick={handleOpenEpisodePage} disabled={!hasEpisodeLink}>
                  Open episode page
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mode-toggle" aria-label="Playback mode">
        <button
          className={activeMode === 'video' ? 'selected' : ''}
          type="button"
          onClick={() => onModeChange('video')}
        >
          Video
        </button>
        <button
          className={activeMode === 'audio' ? 'selected' : ''}
          type="button"
          onClick={() => onModeChange('audio')}
        >
          Audio
        </button>
      </div>
    </section>
  )
}

function cleanDescription(value: string | undefined | null): string {
  if (!value) {
    return ''
  }

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
