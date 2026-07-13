// Telegram channel poster via the free Bot API (create the bot with @BotFather,
// add it as a channel admin; see docs/MARKETING.md §8). Photos are passed as
// public URLs — Telegram fetches them, so no upload step. Supports single
// photo posts, media-group albums (the multi-sport digest), and native polls.

export interface TelegramTarget {
  botToken: string;
  /** Channel id ("-100…") or public handle ("@fantasyfire"). */
  chatId: string;
}

async function call(target: TelegramTarget, method: string, payload: unknown): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${target.botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`telegram ${method} failed (HTTP ${res.status}): ${detail.slice(0, 200)}`);
  }
}

/** Photo post with caption when a card URL exists; plain message otherwise. */
export async function postToTelegram(
  target: TelegramTarget,
  message: { text: string; photoUrl?: string },
): Promise<void> {
  if (message.photoUrl) {
    await call(target, 'sendPhoto', {
      chat_id: target.chatId,
      photo: message.photoUrl,
      caption: message.text,
    });
  } else {
    await call(target, 'sendMessage', {
      chat_id: target.chatId,
      text: message.text,
      disable_web_page_preview: false,
    });
  }
}

/**
 * Album (media group) of 2-10 photos in one message — the multi-sport digest.
 * The caption rides on the first photo (Telegram caption limit is 1024 chars).
 */
export async function postTelegramAlbum(
  target: TelegramTarget,
  album: { photoUrls: string[]; caption: string },
): Promise<void> {
  const photos = album.photoUrls.slice(0, 10);
  if (photos.length < 2) throw new Error('telegram album needs 2-10 photos');
  await call(target, 'sendMediaGroup', {
    chat_id: target.chatId,
    media: photos.map((url, i) => ({
      type: 'photo',
      media: url,
      ...(i === 0 ? { caption: album.caption.slice(0, 1024) } : {}),
    })),
  });
}

/** Anonymous channel poll (2-10 options, ≤100 chars each; question ≤300). */
export async function postTelegramPoll(
  target: TelegramTarget,
  poll: { question: string; options: string[] },
): Promise<void> {
  const options = poll.options.slice(0, 10).map((o) => o.slice(0, 100));
  if (options.length < 2) throw new Error('telegram poll needs 2-10 options');
  await call(target, 'sendPoll', {
    chat_id: target.chatId,
    question: poll.question.slice(0, 300),
    options,
    is_anonymous: true,
  });
}
