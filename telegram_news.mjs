import fs from "fs";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN مفقود");
}

const telegramFile = "telegram_news.json";
const offsetFile = "telegram_offset.json";

// قراءة أخبار Telegram السابقة
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

// قراءة آخر تحديث
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

  // النص أو وصف الصورة
  const postText =
    post.text ||
    post.caption ||
    "";

  if (!postText.trim()) {
    continue;
  }

  // ==========================================
  // استخراج مصدر الخبر الحقيقي
  // ==========================================

  const sourceMatch =
    postText.match(
      /<!--MOWJAZ_SOURCE:(.*?)-->/
    );

  const linkMatch =
    postText.match(
      /<!--MOWJAZ_LINK:(.*?)-->/
    );

  let source =
    sourceMatch?.[1]?.trim() ||
    post.chat?.title ||
    "Telegram";

  let originalLink =
    linkMatch?.[1]?.trim() ||
    "";

  // ==========================================
  // تحديد عنوان الخبر
  // ==========================================

  let title = "";

  if (source === "RT_ARABIC") {

    const lines = postText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .filter(line =>
        !line.startsWith("<!--")
      );

    // الشكل:
    // 📰 RT Arabic
    // عنوان الخبر
    // 🔗 الرابط

    title =
      lines.find(line =>
        !line.startsWith("📰") &&
        !line.startsWith("🔗") &&
        !line.startsWith("http")
      ) || "";

  } else {

    const lines = postText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    title =
      lines[0] ||
      "خبر من Telegram";
  }

  title = title.slice(0, 200);

  if (!title) {
    title = "خبر من Telegram";
  }

  // ==========================================
  // الوصف
  // ==========================================

  const cleanText = postText
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  const description =
    cleanText.slice(0, 500);

  // ==========================================
  // التاريخ
  // ==========================================

  const date =
    new Date(
      post.date * 1000
    ).toISOString();

  // ==========================================
  // منع التكرار
  // ==========================================

  const exists = telegramNews.some(item => {

    // نفس رابط المصدر الأصلي
    if (
      originalLink &&
      item.link === originalLink
    ) {
      return true;
    }

    // نفس Telegram update
    if (
      item.telegramUpdateId ===
      update.update_id
    ) {
      return true;
    }

    // نفس العنوان والتاريخ
    if (
      item.title === title &&
      item.date === date
    ) {
      return true;
    }

    return false;
  });

  if (exists) {
    console.log(
      `خبر مكرر تم تجاهله: ${title}`
    );

    continue;
  }

  // ==========================================
  // تحديد التصنيف
  // ==========================================

  let category = "العالم";

  const textForCategory =
    `${title} ${description}`.toLowerCase();

  if (
    /مصر|القاهرة|الحكومة المصرية|الرئيس المصري/
      .test(textForCategory)
  ) {
    category = "مصر";

  } else if (
    /اقتصاد|اقتصادية|أسواق|نفط|دولار|ذهب|بنك/
      .test(textForCategory)
  ) {
    category = "اقتصاد";

  } else if (
    /رياضة|كرة|مباراة|دوري|منتخب/
      .test(textForCategory)
  ) {
    category = "رياضة";

  } else if (
    /تكنولوجيا|تقنية|ذكاء اصطناعي|هاتف|آيفون/
      .test(textForCategory)
  ) {
    category = "تكنولوجيا";

  } else if (
    /علوم|فضاء|علماء|ناسا/
      .test(textForCategory)
  ) {
    category = "علوم";
  }

  // ==========================================
  // إنشاء الخبر
  // ==========================================

  const item = {
    title,

    link:
      originalLink ||
      "",

    description,

    date,

    source,

    sourceScore:
      source === "RT_ARABIC" ? 10 : 8,

    sourceType:
      "telegram",

    cat:
      category,

    image:
      "",

    sourceCount:
      1,

    sources:
      [source],

    telegramUpdateId:
      update.update_id
  };

  telegramNews.unshift(item);

  added++;

  console.log(
    `تمت إضافة خبر: ${title}`
  );
}

// ==========================================
// الاحتفاظ بعدد معقول من الأخبار
// ==========================================

telegramNews =
  telegramNews.slice(0, 300);

// ==========================================
// حفظ الأخبار
// ==========================================

const output = {
  updatedAt:
    new Date().toISOString(),

  items:
    telegramNews
};

fs.writeFileSync(
  telegramFile,
  JSON.stringify(
    output,
    null,
    2
  ),
  "utf8"
);

// ==========================================
// حفظ Offset
// ==========================================

fs.writeFileSync(
  offsetFile,
  String(newOffset),
  "utf8"
);

// ==========================================
// سجل التشغيل
// ==========================================

console.log(
  `Telegram updates: ${data.result.length}`
);

console.log(
  `Telegram news added: ${added}`
);

console.log(
  `Telegram news total: ${telegramNews.length}`
);
