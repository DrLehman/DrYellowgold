import type { Episode } from '../types'
import { formatEpisodeDuration } from '../episodeFormatters'

interface EpisodeListProps {
  episodes: Episode[]
  selectedEpisode: Episode | null
  isLoading: boolean
  error: string | null
  onSelectEpisode: (episode: Episode) => void
  onDownloadEpisode: (episode: Episode, mediaKind: 'audio' | 'video') => void
}

export function EpisodeList({ episodes, selectedEpisode, isLoading, error, onSelectEpisode, onDownloadEpisode }: EpisodeListProps) {
  if (isLoading) {
    return (
      <div className="empty-state">
        <div className="loading-ring" />
        <strong>Loading RSS feed</strong>
        <span>Fetching the newest episode list.</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty-state error-state">
        <strong>Feed unavailable</strong>
        <span>{error}</span>
      </div>
    )
  }

  if (episodes.length === 0) {
    return (
      <div className="empty-state">
        <strong>No episodes match</strong>
        <span>Clear the search field or select another feed.</span>
      </div>
    )
  }

  return (
    <section className="episode-table" aria-label="Episodes">
      <div className="table-head">
        <span>Episode</span>
        <span>Date</span>
        <span>Duration</span>
        <span>Media</span>
      </div>
      <div className="episode-rows">
        {episodes.map(episode => (
          <button
            className={`episode-row ${selectedEpisode?.guid === episode.guid ? 'selected' : ''}`}
            key={episode.guid}
            type="button"
            onClick={() => onSelectEpisode(episode)}
          >
            <span className="row-play">{selectedEpisode?.guid === episode.guid ? '●' : '▶'}</span>
            <span className="episode-main">
              <strong>{episode.title}</strong>
              <small>{stripHtml(episode.description)}</small>
            </span>
            <span className="episode-date">{formatDate(episode.pubDate)}</span>
            <span className="episode-duration">{formatEpisodeDuration(episode.duration)}</span>
            <span className="episode-media">
              {episode.audioUrl && (
                <button type="button" aria-label={`Download audio for ${episode.title}`} onClick={event => {
                  event.stopPropagation()
                  onDownloadEpisode(episode, 'audio')
                }}>
                  Audio
                </button>
              )}
              {episode.videoUrl && (
                <button type="button" aria-label={`Download video for ${episode.title}`} onClick={event => {
                  event.stopPropagation()
                  onDownloadEpisode(episode, 'video')
                }}>
                  Video
                </button>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
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
