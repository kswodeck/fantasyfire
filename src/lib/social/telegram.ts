// Telegram channel poster via the free Bot API (create the bot with @BotFather,
// add it as a channel admin; see docs/MARKETING.md §8). sendPhoto accepts a
// public image URL — Telegram fetches it, so no upload step.

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
