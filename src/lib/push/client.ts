// Browser Web Push helpers. The VAPID PUBLIC key is not secret (it ships to the
// client); the private key stays server-side in run-push.ts. Everything no-ops
// gracefully when push is unconfigured or unsupported (iOS Safari is fickle).

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export type PushState =
  | 'unconfigured' // no VAPID key set on the deploy
  | 'unsupported' // browser lacks push/notifications
  | 'denied' // user blocked notifications
  | 'default' // can ask
  | 'granted' // permission granted, not subscribed
  | 'subscribed'; // active subscription

export function pushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  // Explicit ArrayBuffer backing so the view satisfies BufferSource under TS 5.7+'s
  // stricter ArrayBuffer typing (a plain `new Uint8Array(n)` infers ArrayBufferLike).
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function currentPushState(): Promise<PushState> {
  if (!pushConfigured()) return 'unconfigured';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) return 'subscribed';
  return Notification.permission === 'granted' ? 'granted' : 'default';
}

/** Request permission, subscribe, and persist the subscription. Returns success. */
export async function subscribeToPush(sports?: string[]): Promise<boolean> {
  if (!pushConfigured() || !pushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const json = sub.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) return false;

  const res = await fetch('/api/v1/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      sports,
    }),
  });
  return res.ok;
}

/** Unsubscribe locally and on the server. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/v1/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
