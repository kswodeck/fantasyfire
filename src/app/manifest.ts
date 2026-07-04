import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Stable identity — lets browsers recognize the installed app even if
    // start_url changes later.
    id: '/',
    name: `${SITE.name} — ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0c0a09',
    theme_color: '#ea580c',
    categories: ['sports', 'utilities'],
    // Long-press / right-click app-icon shortcuts to the highest-value pages.
    shortcuts: [
      {
        name: 'Heat Check',
        short_name: 'Heat Check',
        description: 'Today’s strongest leans across all sports',
        url: '/board',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'My Playbook',
        short_name: 'Playbook',
        description: 'Your saved props',
        url: '/playbook',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'My Players',
        short_name: 'My Players',
        description: 'Your favorited players',
        url: '/my-players',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Screenshots unlock the richer app-store-style install dialog in Chrome —
    // one wide set for desktop, one narrow set for mobile. Labels double as
    // alt text for the install UI.
    screenshots: [
      {
        src: '/screenshots/home-wide.png',
        sizes: '2560x1600',
        type: 'image/png',
        form_factor: 'wide',
        label: 'FantasyFire home — sport hubs and today’s top reads',
      },
      {
        src: '/screenshots/board-wide.png',
        sizes: '2560x1600',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Heat Check — the strongest leans across every in-season league',
      },
      {
        src: '/screenshots/home-narrow.png',
        sizes: '780x1688',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'FantasyFire home — sport hubs and today’s top reads',
      },
      {
        src: '/screenshots/board-narrow.png',
        sizes: '780x1688',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Heat Check — the strongest leans across every in-season league',
      },
    ],
  };
}
