import fs from "fs";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN مفقود");
}

const newsFile = "news.json";
const offsetFile = "telegram_offset.json";

let newsData = {
  updatedAt: new Date().toISOString(),
  items: []
};

// قراءة الأخبار الحالية
if (fs.existsSync(newsFile)) {
  const saved = JSON.parse(
    fs.readFileSync(newsFile, "utf8")
  );

  if (Array.isArray(saved)) {
    newsData.items = saved;
  } else if (Array.isArray(saved.items)) {
    newsData = saved;
  }
}

const news = newsData.items;

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
  throw new Error(`Telegram API error: ${response.status}`);
}

const data = await response.json();

if (!data.ok) {
  throw new Error(
    `Telegram API returned an error: ${data.description || "Unknown error"}`
  );
}

let newOffset = offset;

for (const update of data.result) {
  newOffset = Math.max(
    newOffset,
    update.update_id + 1
  );

  const post =
    update.channel_post ||
    update.message;

  if (!post || !post.text) {
    continue;
  }

  // قناة التجميع التي استقبلت المنشور
  const receivingChannel =
    post.chat?.title || "Telegram";

  const receivingUsername =
    post.chat?.username || "";

  const messageId = post.message_id;

  const receivingLink = receivingUsername
    ? `https://t.me/${receivingUsername}/${messageId}`
    : "";

  // محاولة معرفة المصدر الأصلي للمنشور المعاد توجيهه
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

  const lines = post.text
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const title =
    lines[0]?.slice(0, 200) ||
    "خبر من Telegram";

  const description =
    post.text.slice(0, 240);

  // منع التكرار
  const exists = news.some(item =>
    (originalLink && item.link === originalLink) ||
    (
      item.sourceType === "telegram" &&
      item.title === title &&
      item.date === new Date(post.date * 1000).toISOString()
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
    sources: [originalSource]
  };

  news.push(item);

  console.log(
    `تمت إضافة خبر Telegram من: ${originalSource}`
  );
}

// الحفاظ على جميع الأخبار
const output = {
  updatedAt: new Date().toISOString(),
  items: news
};

fs.writeFileSync(
  newsFile,
  JSON.stringify(output, null, 2),
  "utf8"
);

fs.writeFileSync(
  offsetFile,
  String(newOffset),
  "utf8"
);

console.log(
  `Telegram updates: ${data.result.length}`
);

console.log(
  `News total: ${news.length}`
);
