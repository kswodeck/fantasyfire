// Discord webhook poster — one POST, no auth beyond the webhook URL itself.
// Used for the public #daily-leans channel (single embeds, the multi-sport
// digest with one embed per sport, and native polls) and the private
// owner-only content-pack channel (plain content messages).

export interface DiscordEmbed {
  title: string;
  description?: string;
  url?: string;
  /** Card image by URL — Discord fetches it; no upload needed. */
  imageUrl?: string;
  /** Accent color as a hex string, e.g. "#ea580c". */
  color?: string;
}

export interface DiscordPoll {
  question: string;
  /** 2-10 answers, ≤55 chars each (Discord's poll-answer limit). */
  options: string[];
  /** Poll length in hours (Discord default 24, max 768). */
  durationHours?: number;
}

function embedJson(e: DiscordEmbed) {
  return {
    title: e.title,
    ...(e.description ? { description: e.description } : {}),
    ...(e.url ? { url: e.url } : {}),
    ...(e.imageUrl ? { image: { url: e.imageUrl } } : {}),
    ...(e.color ? { color: parseInt(e.color.replace('#', ''), 16) } : {}),
  };
}

export async function postToDiscordWebhook(
  webhookUrl: string,
  message: {
    content?: string;
    embed?: DiscordEmbed;
    /** Up to 10 embeds in one message (the multi-sport digest). */
    embeds?: DiscordEmbed[];
    poll?: DiscordPoll;
  },
): Promise<void> {
  const { content, embed, embeds, poll } = message;
  const allEmbeds = [...(embed ? [embed] : []), ...(embeds ?? [])].slice(0, 10);
  const body = {
    ...(content ? { content } : {}),
    ...(allEmbeds.length > 0 ? { embeds: allEmbeds.map(embedJson) } : {}),
    ...(poll
      ? {
          poll: {
            question: { text: poll.question.slice(0, 300) },
            answers: poll.options.slice(0, 10).map((text) => ({
              poll_media: { text: text.slice(0, 55) },
            })),
            duration: poll.durationHours ?? 24,
            allow_multiselect: false,
          },
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
