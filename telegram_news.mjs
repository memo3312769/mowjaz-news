import fs from "fs";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN مفقود");
}

const telegramFile = "telegram_news.json";
const offsetFile = "telegram_offset.json";

// قراءة أخبار Telegram السابقة فقط
let telegramNews = [];

if (fs.existsSync(telegramFile)) {
  try {
    const saved = JSON.parse(
      fs.readFileSync(telegramFile, "utf8")
    );

    telegramNews = Array.isArray(saved)
      ? saved
      : saved.items || [];

  } catch {
    telegramNews = [];
  }
}

// قراءة آخر تحديث تمت معالجته
let offset = 0;

if (fs.existsSync(offsetFile)) {
  offset =
    Number(fs.readFileSync(offsetFile, "utf8")) || 0;
}

const url =
  `https://api.telegram.org/bot${token}/getUpdates` +
  `?timeout=10&offset=${offset}`;

const response = await fetch(url);

if (!response.ok) {
  throw new Error(
    `Telegram API error: ${response.status}`
  );
}

const data = await response.json();

if (!data.ok) {
  throw new Error(
    `Telegram API returned an error: ${
      data.description || "Unknown error"
    }`
  );
}

let newOffset = offset;
let added = 0;

for (const update of data.result) {
  newOffset = Math.max(
    newOffset,
    update.update_id + 1
  );

  const post =
    update.channel_post ||
    update.message;

  if (!post) {
    continue;
  }

  // يدعم النصوص والتعليقات المصاحبة للصور
  const postText =
    post.text ||
    post.caption ||
    "";

  if (!postText.trim()) {
    continue;
  }

  // القناة التي استقبلت المنشور
  const receivingChannel =
    post.chat?.title || "Telegram";

  const receivingUsername =
    post.chat?.username || "";

  const messageId = post.message_id;

  const receivingLink = receivingUsername
    ? `https://t.me/${receivingUsername}/${messageId}`
    : "";

  // معرفة المصدر الأصلي إذا كان المنشور معاد التوجيه
  const origin = post.forward_origin;

  let originalSource = receivingChannel;
  let originalUsername = "";
  let originalMessageId = "";

  if (
    origin &&
    origin.type === "channel" &&
    origin.chat
  ) {
    originalSource =
      origin.chat.title || receivingChannel;

    originalUsername =
      origin.chat.username || "";

    originalMessageId =
      origin.message_id || "";
  }

  const originalLink =
    originalUsername && originalMessageId
      ? `https://t.me/${originalUsername}/${originalMessageId}`
      : receivingLink;

  const lines = postText
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const title =
    lines[0]?.slice(0, 200) ||
    "خبر من Telegram";

  const description =
    postText.slice(0, 240);

  // منع تكرار الخبر
  const exists = telegramNews.some(item =>
    (
      originalLink &&
      item.link === originalLink
    ) ||
    (
      item.telegramUpdateId === update.update_id
    ) ||
    (
      item.title === title &&
      item.date === new Date(
        post.date * 1000
      ).toISOString()
    )
  );

  if (exists) {
    continue;
  }

  const item = {
    title,
    link: originalLink,
    description,
    date: new Date(
      post.date * 1000
    ).toISOString(),
    source: originalSource,
    sourceScore: 8,
    sourceType: "telegram",
    cat: "العالم",
    image: "",
    sourceCount: 1,
    sources: [originalSource],
    telegramUpdateId: update.update_id
  };

  telegramNews.push(item);
  added++;

  console.log(
    `تمت إضافة خبر Telegram من: ${originalSource}`
  );
}

// حفظ أخبار Telegram في ملف مستقل
const output = {
  updatedAt: new Date().toISOString(),
  items: telegramNews
};

fs.writeFileSync(
  telegramFile,
  JSON.stringify(output, null, 2),
  "utf8"
);

// حفظ موضع آخر تحديث
fs.writeFileSync(
  offsetFile,
  String(newOffset),
  "utf8"
);

console.log(
  `Telegram updates: ${data.result.length}`
);

console.log(
  `Telegram news added: ${added}`
);

console.log(
  `Telegram news total: ${telegramNews.length}`
);
