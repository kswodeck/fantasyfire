// Discord webhook poster — one POST, no auth beyond the webhook URL itself.
// Used for both the public #daily-leans channel and the private owner-only
// content-pack channel (two different webhook URLs; see docs/MARKETING.md §8).

export interface DiscordEmbed {
  title: string;
  description?: string;
  url?: string;
  /** Card image by URL — Discord fetches it; no upload needed. */
  imageUrl?: string;
  /** Accent color as a hex string, e.g. "#ea580c". */
  color?: string;
}

export async function postToDiscordWebhook(
  webhookUrl: string,
  message: { content?: string; embed?: DiscordEmbed },
): Promise<void> {
  const { content, embed } = message;
  const body = {
    ...(content ? { content } : {}),
    ...(embed
      ? {
          embeds: [
            {
              title: embed.title,
              ...(embed.description ? { description: embed.description } : {}),
              ...(embed.url ? { url: embed.url } : {}),
              ...(embed.imageUrl ? { image: { url: embed.imageUrl } } : {}),
              ...(embed.color ? { color: parseInt(embed.color.replace('#', ''), 16) } : {}),
            },
          ],
        }
      : {}),
  };
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`discord webhook failed (HTTP ${res.status}): ${detail.slice(0, 200)}`);
  }
}
