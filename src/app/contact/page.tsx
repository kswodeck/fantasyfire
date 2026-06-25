import { permanentRedirect } from 'next/navigation';

// Contact now lives as a section on the About page. Permanently redirect so old
// links and bookmarks land on it.
export default function ContactRedirect() {
  permanentRedirect('/about#contact');
}
