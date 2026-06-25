import { absoluteUrl } from './site';

/**
 * BreadcrumbList JSON-LD from the same crumbs the visual <Breadcrumbs> renders —
 * keep the two in sync. `path` is a relative app path (resolved to absolute here).
 */
export function breadcrumbList(items: { name: string; path?: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.path ? { item: absoluteUrl(it.path) } : {}),
    })),
  };
}

/** A free, FantasyFire-credited Dataset node for a reference/research page. */
export function datasetNode(opts: {
  name: string;
  description: string;
  path: string;
  dateModified?: string | null;
}) {
  return {
    '@type': 'Dataset',
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.path),
    isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: 'FantasyFire' },
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
  };
}

/** Wrap nodes in a schema.org @graph document. */
export function graph(nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
