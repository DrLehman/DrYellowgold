import { AddFeedForm } from './AddFeedForm'
import type { CustomFeedSource, FeedSource } from '../types'

export type AppView = 'shows' | 'queue' | 'downloads' | 'settings'

interface SidebarProps {
  sources: FeedSource[]
  customFeeds: CustomFeedSource[]
  selectedSourceId: string | null
  lastUpdatedLabel: string
  activeView: AppView
  queueCount: number
  downloadCount: number
  onSelectView: (view: AppView) => void
  onSelectSource: (source: FeedSource) => void
  onAddFeed: (feed: CustomFeedSource) => void
  onRemoveFeed: (feedId: string) => void
}

export function Sidebar({
  sources,
  customFeeds,
  selectedSourceId,
  lastUpdatedLabel,
  activeView,
  queueCount,
  downloadCount,
  onSelectView,
  onSelectSource,
  onAddFeed,
  onRemoveFeed,
}: SidebarProps) {
  // The sidebar separates built-in Jason Howell/Yellowgold sources from
  // local/private feeds because the privacy model is different: public sources
  // are safe static catalog entries, while custom feeds may contain tokenized
  // URLs and need remove controls. Android Faithful is intentionally shown with
  // the built-in sources because the user chose to include active Jason-hosted
  // work even when the production umbrella is not purely Yellowgold Studios.
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-word">
          <span>Dr</span>Yellowgold
        </div>
      </div>

      <nav className="primary-nav" aria-label="Primary">
        <button className={`nav-item ${activeView === 'shows' ? 'active' : ''}`} type="button" onClick={() => onSelectView('shows')}>
          <span className="nav-icon">▦</span>
          Shows
        </button>
        <button className={`nav-item ${activeView === 'queue' ? 'active' : ''}`} type="button" onClick={() => onSelectView('queue')}>
          <span className="nav-icon">☰</span>
          Queue
          <span className="nav-count">{queueCount}</span>
        </button>
        <button className={`nav-item ${activeView === 'downloads' ? 'active' : ''}`} type="button" onClick={() => onSelectView('downloads')}>
          <span className="nav-icon">↓</span>
          Downloads
          <span className="nav-count">{downloadCount}</span>
        </button>
      </nav>

      <div className="source-section shows-section">
        <div className="section-label">Shows</div>
        <div className="source-list">
          {sources.map(source => (
            <button
              className={`source-row ${selectedSourceId === source.id ? 'selected' : ''}`}
              key={source.id}
              type="button"
              onClick={() => {
                onSelectView('shows')
                onSelectSource(source)
              }}
            >
              <span className="source-art">
                {source.artworkUrl ? <img src={source.artworkUrl} alt="" /> : source.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="source-name">{source.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="source-section custom-section">
        <div className="section-label">Local feeds</div>
        {customFeeds.length === 0 ? (
          <p className="sidebar-note">Add private RSS URLs here. They stay in local app storage.</p>
        ) : (
          <div className="source-list">
            {customFeeds.map(feed => (
              <div className="custom-feed-row" key={feed.id}>
                <button
                  className={`source-row custom ${selectedSourceId === feed.id ? 'selected' : ''}`}
                  type="button"
                  onClick={() => {
                    onSelectView('shows')
                    onSelectSource(feed)
                  }}
                >
                  <span className="source-art private">
                    {feed.artworkUrl ? <img src={feed.artworkUrl} alt="" /> : 'RSS'}
                  </span>
                  <span className="source-name">{feed.name}</span>
                </button>
                <button
                  className="remove-feed-button"
                  type="button"
                  aria-label={`Remove ${feed.name}`}
                  onClick={() => onRemoveFeed(feed.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <AddFeedForm onAddFeed={onAddFeed} />
      </div>

      <div className="sidebar-footer">
        <button className={`nav-item settings-button ${activeView === 'settings' ? 'active' : ''}`} type="button" onClick={() => onSelectView('settings')}>
          <span className="nav-icon">⚙</span>
          Settings
        </button>
        <div className="sync-card">
          <div>
            <span className="status-dot" />
            RSS updated
          </div>
          <strong>{lastUpdatedLabel}</strong>
        </div>
      </div>
    </aside>
  )
}
