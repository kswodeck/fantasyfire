import { permanentRedirect } from 'next/navigation';

// /my-players was the original saved-players route. It's now "My Playbook" at
// /playbook (players + props). Permanently redirect so old bookmarks, the push
// digest, and any external links keep working.
export default function MyPlayersRedirect() {
  permanentRedirect('/playbook');
}
