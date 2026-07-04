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
  };
}
