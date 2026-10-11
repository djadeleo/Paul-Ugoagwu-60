/**
 * Single place to customise the site.
 * Slideshow photos/videos: just drop files into /public/images/slidehome (see docs/OPERATIONS.md).
 */
export const siteConfig = {
  name: 'Paul Ugoagwu',
  age: 60,
  title: 'Paul Ugoagwu @ 60',
  tagline: 'Celebrating a life of faith, family and friendship',
  description:
    'Join family and friends around the world in celebrating Paul Ugoagwu at 60. Leave a wish, a prayer, a photo or a video message.',

  theme: {
    bg: '#0B1530', // Midnight Blue
    bgSoft: '#111F45',
    card: '#16275A',
    platinum: '#E5E4E2',
    platinumDim: '#A9ADB8',
  },

  thankYouNote: {
    heading: 'A note of thanks',
    body: [
      'To everyone near and far who has taken a moment to send a word, a prayer or a smile: thank you.',
      'Sixty years is a gift, and you are a big part of it. Your kindness means more than I can say.',
    ],
    signature: '— Paul',
  },

  slideshow: {
    intervalMs: 6000, // home hero: seconds per photo
  },

  // After this moment the Add Wish form shows "Wishes are now closed". null = never closes.
  // Example: '2026-12-31T23:59:59Z'
  wishesCloseDate: null as string | null,

  limits: {
    videoMaxMB: 50,
    videoMaxSeconds: 45,
    photoMaxMB: 5,
    photoMaxWidth: 1600,
    thumbWidth: 480,
    messageMaxChars: 1000,
    // Cloudflare R2 free tier = 10 GB. Video uploads close at 8 GB; everything stops at 9.5 GB.
    videoCloseAtGB: 8,
    hardCapGB: 9.5,
    allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    allowedPhotoTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
} as const;
