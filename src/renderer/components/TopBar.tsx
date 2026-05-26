interface TopBarProps {
  query: string
  searchMode: 'show' | 'global'
  isLoading: boolean
  statusLabel: string
  statusDetail: string
  onQueryChange: (value: string) => void
  onSearchModeChange: (value: 'show' | 'global') => void
  onRefresh: () => void
  onFocusSearch: () => void
  onFilter: () => void
}

export function TopBar({ query, searchMode, isLoading, statusLabel, statusDetail, onQueryChange, onSearchModeChange, onRefresh, onFocusSearch, onFilter }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="history-controls" aria-hidden="true">
        <button type="button" onClick={onFocusSearch}>‹</button>
        <button type="button" onClick={onFocusSearch}>›</button>
      </div>
      <button className="refresh-button" type="button" aria-label="Refresh feed" onClick={onRefresh} disabled={isLoading}>
        Refresh
      </button>
      <label className="search-mode-control">
        <span className="visually-hidden">Search mode</span>
        <select
          aria-label="Search mode"
          value={searchMode}
          onChange={event => onSearchModeChange(event.target.value as 'show' | 'global')}
        >
          <option value="show">Show</option>
          <option value="global">Global</option>
        </select>
      </label>
      <label className="search-box">
        <span>⌕</span>
        <input
          type="search"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder={searchMode === 'global' ? 'Search all shows' : 'Search this show'}
        />
        <kbd>⌘K</kbd>
      </label>
      <button className="filter-control" type="button" onClick={onFilter}>Filter</button>
      <div className="health-status">
        <span className={isLoading ? 'pulse-dot' : 'check-dot'} />
        <div>
          <strong>{isLoading ? 'Updating' : statusLabel}</strong>
          <small>{isLoading ? 'Fetching RSS' : statusDetail}</small>
        </div>
      </div>
    </header>
  )
}
