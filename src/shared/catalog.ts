import type { FeedSource } from './types'

export type BuiltInFeedSource = FeedSource & {
  kind: 'builtin'
  feedUrl: string
  videoFeedUrl: string
  videoPageUrl?: string
}

// DrYellowgold's built-in catalog is deliberately narrower than Jason Howell's
// full career history. The app is meant to surface current Jason/Yellowgold
// work, so former TWiT-era programs, the old Club TWiT AI Inside beta feed, and
// guest appearances on other podcasts are excluded even when they remain
// discoverable on the web. Each entry below was chosen because it has a public,
// currently reachable podcast RSS feed or original YouTube page/list link that
// can be handled without adding a new service dependency.
//
// Audio mode uses podcast RSS where a show has one. Video mode does not try to
// fetch YouTube RSS anymore because those endpoints proved unreliable in local
// validation; instead the renderer uses `videoPageUrl` to show a direct link to
// the original YouTube channel, uploads page, or playlist. The legacy
// `videoFeedUrl` field remains for the inherited feed contract and custom feeds,
// but built-in Yellowgold video behavior is link-first.
export const BUILT_IN_SOURCES: BuiltInFeedSource[] = [
  {
    id: 'ai-inside',
    kind: 'builtin',
    name: 'AI Inside',
    description: 'Jason Howell and Jeff Jarvis cover the week in artificial intelligence with interviews and analysis. Support AI Inside at https://www.patreon.com/cw/AIInsideshow.',
    feedUrl: 'https://feeds.megaphone.fm/aiinsideshow',
    videoFeedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCpoCFyZKqdeWTYvcdEfIkBA',
    videoPageUrl: 'https://www.youtube.com/@aiinsideshow/videos',
    supportUrl: 'https://www.patreon.com/cw/AIInsideshow',
    hasVideo: true,
    artworkUrl: 'https://megaphone.imgix.net/podcasts/caa75296-a289-11ef-823b-c3437215a7d1/image/9819fa7e838e38cc71bb62ba36c3da80.jpg?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress',
  },
  {
    id: 'techsploder',
    kind: 'builtin',
    name: 'Techsploder',
    description: 'Jason Howell talks with tech professionals about being human in a binary world. Video mode uses Jason Howell YouTube uploads because Techsploder videos live there.',
    feedUrl: 'https://feeds.acast.com/public/shows/66231b9b6556260012ad3257',
    videoFeedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCjLhgO65TFpp0TOZhaoUnGA',
    videoPageUrl: 'https://www.youtube.com/@JasonHowell/videos',
    hasVideo: true,
    artworkUrl: 'https://megaphone.imgix.net/podcasts/5b25c2e4-ca30-11ef-a850-3b2b7ec014ba/image/3b09d8134a8c5003aac8fb948bed6450.jpeg?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress',
  },
  {
    id: 'android-faithful',
    kind: 'builtin',
    name: 'Android Faithful',
    description: 'Jason Howell, Huyen Tue Dao, Mishaal Rahman, Ron Richards, and Android friends cover Android news and hardware. Video mode uses the Android Faithful playlist on Daily Tech News Show.',
    feedUrl: 'https://feeds.acast.com/public/shows/649f5be290e2100011cf6c40',
    videoFeedUrl: 'https://www.youtube.com/feeds/videos.xml?playlist_id=PLHN12N7TXUyfvNb0GyYVUVus_B4GjgDWj',
    videoPageUrl: 'https://www.youtube.com/playlist?list=PLHN12N7TXUyfvNb0GyYVUVus_B4GjgDWj',
    hasVideo: true,
    artworkUrl: 'https://assets.pippa.io/shows/649f5be290e2100011cf6c40/1688592510505-a97509791b79123ba35b813d47e761c1.jpeg',
  },
  {
    id: 'jason-howell-youtube',
    kind: 'builtin',
    name: 'Jason Howell',
    description: 'Jason Howell videos about the human side of technology, including mobile tech, wearables, AI, and digital creativity. Support Jason at https://www.patreon.com/JasonHowell.',
    feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCjLhgO65TFpp0TOZhaoUnGA',
    videoFeedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCjLhgO65TFpp0TOZhaoUnGA',
    videoPageUrl: 'https://www.youtube.com/@JasonHowell/videos',
    supportUrl: 'https://www.patreon.com/JasonHowell',
    hasVideo: true,
    artworkUrl: './assets/jason-howell-youtube.jpg',
  },
]
