import { permanentRedirect } from 'next/navigation';

// The glossary now lives alongside the FAQ on one "FAQ & glossary" page.
// Permanently redirect so old links and bookmarks keep working.
export default function GlossaryRedirect() {
  permanentRedirect('/faq');
}
