import OpenAI from 'openai';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!TELEGRAM_BOT_TOKEN || !OPENAI_API_KEY) {
  console.error('Missing required env vars: TELEGRAM_BOT_TOKEN, OPENAI_API_KEY');
  process.exit(1);
}

// Style definitions
const STYLES: Record<string, { name: string; emoji: string; prompt: string }> = {
  standard: {
    name: 'Helpful',
    emoji: '💬',
    prompt: 'Be HELPFUL - explain something, add context, or share useful info. Sound like a friendly dev answering a question.',
  },
  humor: {
    name: 'Humor',
    emoji: '😂',
    prompt: 'Be FUNNY or playful. Make a light joke, use irony, or banter. Show the team has personality. Dont be cringe.',
  },
  invite: {
    name: 'Invite',
    emoji: '👋',
    prompt: 'INVITE them to try the product: "come test with us", "testnet is live", "try the bridge". Friendly invitation, not pushy sales.',
  },
  explain: {
    name: 'Explain',
    emoji: '🧠',
    prompt: 'EXPLAIN how something works. Be technical but accessible. Share the "why" behind what you built.',
  },
  engage: {
    name: 'Engage',
    emoji: '💭',
    prompt: 'Just ENGAGE with their topic naturally. Agree, add perspective, or share a thought. Mention arc treasury only if super natural.',
  },
  question: {
    name: 'Question',
    emoji: '❓',
    prompt: 'ASK them a genuine question to start conversation. Be curious about their opinion or experience.',
  },
};

const SYSTEM_PROMPT = `You are the voice of Arc Treasury's official Twitter account. You're a small team building DeFi on Circle's new Arc blockchain.

## Your vibe:
You're the PROJECT TEAM, but you talk like real humans - casual, friendly, helpful. Not corporate PR speak. Think: indie dev team that's genuinely excited about what they're building and wants to help people try it.

## About Arc Treasury:
- Testnet is LIVE on Arc blockchain (Circle's new L1)
- Earn ~4.2% APY from real T-bills via Hashnote USYC
- Bridge USDC from Ethereum using CCTP v2 (native, no wrapped tokens)
- Points system → converts to ARC governance token later
- Early Supporter NFT (5k supply) = permanent 1.2x points boost
- Locked deposits = up to 3x point multiplier
- First DeFi protocol on Arc chain
- Website: arctreasury.biz

## Your goal:
ENGAGE genuinely. Invite people to TEST the product. Answer implied questions. Add value to conversations. Be helpful, not salesy.

As the official account you can:
- Say "we built this because..."
- Invite: "come test with us", "try the bridge"
- Explain how things work
- Be proud but humble about what you're building

## CRITICAL RULES:
1. LOWERCASE only (except USDC, Arc, NFT, CCTP)
2. MAX 1-2 short sentences
3. Sound like a HUMAN dev team, not a marketing department
4. Use ct language naturally: ngl, tbh, rn, lfg, fwiw
5. NO emojis or MAX 1
6. NEVER: "excited to announce", "game-changer", "revolutionary", "thrilled"
7. NO hashtags
8. Be HELPFUL and GENUINE, not pushy

## Good examples (as official account):
- "yeah we built this on cctp v2 specifically for native usdc. no wrapped token nonsense"
- "testnet is live if you wanna try it out. bridge takes like 30 sec"
- "we use real t-bill yield from hashnote, not fake apy from emissions"
- "early supporter nft is free rn, only 5k supply tho"
- "come farm some points on testnet, they'll convert to tokens later"
- "the 3x multiplier is for 12 month lock. flexible is 1x but you can withdraw anytime"

## BAD examples:
- "🚀🔥 We're THRILLED to announce our REVOLUTIONARY platform!"
- "Arc Treasury is the future of DeFi! Don't miss out!"
- "Our amazing features include: 1) 2) 3)"

## Output:
Return 3 comments, numbered 1-3.
- One that adds value/explains something relevant to the tweet
- One that invites to try/test
- One that's more casual/engaging with the topic`;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Cache types
interface PendingTweet {
  tweetUrl: string;
  author: string;
  text: string;
}

interface CommentWithTranslation {
  en: string;
  ru: string;
}

interface GeneratedComments {
  comments: CommentWithTranslation[];
  tweetUrl: string;
  style: string;
}

// Caches
const pendingTweets = new Map<string, PendingTweet>();
const commentCache = new Map<string, GeneratedComments>();

// Escape Markdown special chars
function escapeMarkdown(text: string): string {
  return text.replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
}

async function fetchTweet(tweetUrl: string): Promise<{ author: string; text: string } | null> {
  try {
    const match = tweetUrl.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/);
    if (!match) {
      console.log('Invalid tweet URL:', tweetUrl);
      return null;
    }
    const [, username, tweetId] = match;
    console.log(`Fetching tweet: @${username}/status/${tweetId}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://api.fxtwitter.com/${username}/status/${tweetId}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log('FxTwitter response not ok:', response.status);
      return null;
    }
    const data = await response.json() as any;
    console.log('Tweet fetched successfully');
    return { author: data.tweet?.author?.screen_name || username, text: data.tweet?.text || '' };
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.error('Tweet fetch timeout (10s)');
    } else {
      console.error('Error fetching tweet:', e.message);
    }
    return null;
  }
}

async function generateComments(tweetAuthor: string, tweetText: string, style: string): Promise<CommentWithTranslation[]> {
  try {
    const styleInfo = STYLES[style] || STYLES.standard;
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Generate 3 comment options for this tweet.

STYLE: ${styleInfo.prompt}

Author: @${tweetAuthor}
Tweet: "${tweetText}"

Remember: lowercase, casual, short, human-sounding. Follow the style instruction carefully.

IMPORTANT: Return ONLY valid JSON array, no other text:
[
  {"en": "english comment 1", "ru": "русский перевод 1"},
  {"en": "english comment 2", "ru": "русский перевод 2"},
  {"en": "english comment 3", "ru": "русский перевод 3"}
]` }
      ],
      // @ts-ignore
      reasoning_effort: 'none',
      max_completion_tokens: 800,
    });
    const content = response.choices[0]?.message?.content || '';

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as CommentWithTranslation[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(c => c.en && c.ru);
        }
      }
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
    }

    return [{ en: content.trim(), ru: content.trim() }];
  } catch (e) {
    console.error('Error generating comments:', e);
    return [{ en: 'Error generating comment. Please try again.', ru: 'Ошибка генерации. Попробуйте снова.' }];
  }
}

interface TelegramUpdate {
  update_id: number;
  message?: { message_id: number; chat: { id: number }; text?: string };
  callback_query?: { id: string; message?: { chat: { id: number }, message_id: number }; data?: string };
}

async function sendMessage(chatId: number, text: string, replyMarkup?: object): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...(replyMarkup && { reply_markup: replyMarkup }) }),
  });
  const data = await res.json() as any;
  if (!data.ok) {
    console.error('Telegram sendMessage error:', data.description);
  }
  return data;
}

async function editMessage(chatId: number, messageId: number, text: string, replyMarkup?: object): Promise<void> {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown', ...(replyMarkup && { reply_markup: replyMarkup }) }),
  });
}

async function answerCallback(id: string, text?: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text: text || 'Done' }),
  });
}

function buildStyleSelector(): object {
  const buttons = Object.entries(STYLES).map(([key, style]) => ({
    text: `${style.emoji} ${style.name}`,
    callback_data: `style_${key}`,
  }));

  return {
    inline_keyboard: [
      buttons.slice(0, 3),  // First row: standard, humor, smart
      buttons.slice(3, 6),  // Second row: subtle, hype, question
    ],
  };
}

function buildCommentMessage(comments: CommentWithTranslation[], index: number, style: string, tweetUrl: string): { text: string, keyboard: object } {
  const total = comments.length;
  const comment = comments[index];
  const styleInfo = STYLES[style] || STYLES.standard;

  const text = `${styleInfo.emoji} *${styleInfo.name}* | ${index + 1}/${total}\n\n${comment.en}\n\n_${escapeMarkdown(comment.ru)}_`;

  const buttons: any[] = [];

  // Navigation row
  const navRow: any[] = [];
  if (index > 0) navRow.push({ text: '⬅️', callback_data: `nav_${index - 1}` });
  navRow.push({ text: '📋 Copy', copy_text: { text: comment.en } });
  if (index < total - 1) navRow.push({ text: '➡️', callback_data: `nav_${index + 1}` });
  buttons.push(navRow);

  // Open tweet + actions row
  buttons.push([
    { text: '🔗 Open Tweet', url: tweetUrl },
    { text: '🎨 Style', callback_data: 'change_style' },
    { text: '🔄', callback_data: 'regenerate' },
  ]);

  return { text, keyboard: { inline_keyboard: buttons } };
}

async function handleMessage(chatId: number, text: string): Promise<void> {
  if (text.includes('twitter.com') || text.includes('x.com')) {
    await sendMessage(chatId, '🔍 Reading tweet...');

    const tweet = await fetchTweet(text);
    if (!tweet) {
      await sendMessage(chatId, '❌ Could not read tweet.');
      return;
    }

    // Store pending tweet
    const cacheKey = `${chatId}`;
    pendingTweets.set(cacheKey, { tweetUrl: text, author: tweet.author, text: tweet.text });

    // Show tweet and ask for style
    await sendMessage(
      chatId,
      `📝 *@${tweet.author}:*\n"${escapeMarkdown(tweet.text)}"\n\n🎨 *Choose comment style:*`,
      buildStyleSelector()
    );

  } else if (text === '/start') {
    await sendMessage(chatId, `👋 *Arc Treasury Comment Bot*

Send me a Twitter/X link and I'll generate comments from official @arctreasury perspective.

*Styles:*
💬 Helpful - объяснить, добавить контекст
😂 Humor - шутка, ирония, легкость
👋 Invite - пригласить попробовать продукт
🧠 Explain - техническое объяснение
💭 Engage - включиться в тему естественно
❓ Question - задать вопрос для диалога

📋 Copy → копирует в буфер
🎨 Style → сменить стиль
🔄 Regenerate → новые варианты`);
  } else {
    await sendMessage(chatId, '🔗 Send a Twitter/X link\n\nExample: https://x.com/USDC/status/123');
  }
}

async function handleCallback(callbackId: string, chatId: number, messageId: number, data: string): Promise<void> {
  const cacheKey = `${chatId}`;

  // Handle style selection
  if (data.startsWith('style_')) {
    const style = data.replace('style_', '');
    const pending = pendingTweets.get(cacheKey);

    if (!pending) {
      await answerCallback(callbackId, '⚠️ Send a new tweet link');
      return;
    }

    const styleInfo = STYLES[style] || STYLES.standard;
    await answerCallback(callbackId, `${styleInfo.emoji} Generating ${styleInfo.name.toLowerCase()} comments...`);
    await editMessage(chatId, messageId, `📝 *@${pending.author}:*\n"${pending.text}"\n\n⏳ Generating ${styleInfo.name.toLowerCase()} comments...`);

    const comments = await generateComments(pending.author, pending.text, style);
    commentCache.set(cacheKey, { comments, tweetUrl: pending.tweetUrl, style });

    // Clean old caches
    if (commentCache.size > 100) {
      const firstKey = commentCache.keys().next().value;
      if (firstKey) commentCache.delete(firstKey);
    }

    const { text, keyboard } = buildCommentMessage(comments, 0, style, pending.tweetUrl);
    await editMessage(chatId, messageId, text, keyboard);
    return;
  }

  // Handle change style
  if (data === 'change_style') {
    const cached = commentCache.get(cacheKey);
    if (!cached) {
      await answerCallback(callbackId, '⚠️ Send a new tweet link');
      return;
    }

    // Re-fetch tweet info for display
    const tweet = await fetchTweet(cached.tweetUrl);
    if (tweet) {
      pendingTweets.set(cacheKey, { tweetUrl: cached.tweetUrl, author: tweet.author, text: tweet.text });
      await editMessage(chatId, messageId, `📝 *@${tweet.author}:*\n"${escapeMarkdown(tweet.text)}"\n\n🎨 *Choose comment style:*`, buildStyleSelector());
    }
    await answerCallback(callbackId);
    return;
  }

  // Rest of callbacks need cached comments
  const cached = commentCache.get(cacheKey);
  if (!cached) {
    await answerCallback(callbackId, '⚠️ Send a new tweet link');
    return;
  }

  if (data.startsWith('nav_')) {
    const index = parseInt(data.replace('nav_', ''), 10);
    const { text, keyboard } = buildCommentMessage(cached.comments, index, cached.style, cached.tweetUrl);
    await editMessage(chatId, messageId, text, keyboard);
    await answerCallback(callbackId);

  } else if (data === 'regenerate') {
    const styleInfo = STYLES[cached.style] || STYLES.standard;
    await answerCallback(callbackId, `🔄 Regenerating ${styleInfo.name.toLowerCase()}...`);

    const tweet = await fetchTweet(cached.tweetUrl);
    if (!tweet) {
      await answerCallback(callbackId, '❌ Could not read tweet');
      return;
    }

    const comments = await generateComments(tweet.author, tweet.text, cached.style);
    commentCache.set(cacheKey, { comments, tweetUrl: cached.tweetUrl, style: cached.style });

    const { text, keyboard } = buildCommentMessage(comments, 0, cached.style, cached.tweetUrl);
    await editMessage(chatId, messageId, text, keyboard);
  }
}

async function pollUpdates(): Promise<void> {
  let offset = 0;
  console.log('🤖 Arc Treasury Comment Bot started!');

  while (true) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`);
      const data = await res.json() as { ok: boolean; result: TelegramUpdate[] };

      if (data.ok && data.result.length > 0) {
        for (const u of data.result) {
          offset = u.update_id + 1;
          if (u.message?.text) {
            await handleMessage(u.message.chat.id, u.message.text);
          }
          if (u.callback_query?.message && u.callback_query.data) {
            await handleCallback(u.callback_query.id, u.callback_query.message.chat.id, u.callback_query.message.message_id, u.callback_query.data);
          }
        }
      }
    } catch (e) {
      console.error('Poll error:', e);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

pollUpdates();
