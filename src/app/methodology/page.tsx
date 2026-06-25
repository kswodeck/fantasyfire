import { permanentRedirect } from 'next/navigation';

// Methodology was merged into the "How it works" page — same content, friendlier
// home. Permanently redirect so old links and bookmarks keep working.
export default function MethodologyRedirect() {
  permanentRedirect('/how-it-works');
}
