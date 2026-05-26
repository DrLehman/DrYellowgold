// RSS feeds do not agree on `itunes:duration` shape. Some publish `HH:MM:SS`,
// some publish `MM:SS`, and AI Inside currently publishes plain seconds such as
// `4820`. The episode tables should never expose those raw seconds because the
// unit is ambiguous to users, so this formatter converts numeric second counts
// into clock-style labels while preserving already-readable feed values.
export function formatEpisodeDuration(value: string): string {
  const duration = value.trim()
  if (!duration) {
    return '—'
  }

  if (/^\d+$/.test(duration)) {
    return formatSeconds(Number(duration))
  }

  return duration
}

function formatSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '—'
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
