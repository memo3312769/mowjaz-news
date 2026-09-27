import fs from "fs";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN مفقود");
}

const telegramFile = "telegram_news.json";
const offsetFile = "telegram_offset.json";

// ==========================================
// قراءة أخبار Telegram السابقة
// ==========================================

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

// ==========================================
// قراءة آخر Offset
// ==========================================

let offset = 0;

if (fs.existsSync(offsetFile)) {
  offset =
    Number(
      fs.readFileSync(offsetFile, "utf8")
    ) || 0;
}

// ==========================================
// Telegram API
// ==========================================

const url =
  `https://api.telegram.org/bot${token}/getUpdates` +
  `?timeout=10&offset=${offset}`;

console.log("بدء قراءة Telegram...");
console.log(`Offset الحالي: ${offset}`);

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

console.log(
  `Telegram updates received: ${data.result.length}`
);

// ==========================================
// معالجة التحديثات
// ==========================================

let newOffset = offset;
let added = 0;

for (const update of data.result) {

  newOffset = Math.max(
    newOffset,
    update.update_id + 1
  );

  // ========================================
  // استخراج المنشور
  // ========================================

  const post =
    update.channel_post ||
    update.message;

  if (!post) {
    console.log(
      `Update ${update.update_id}: لا يوجد message/channel_post`
    );

    continue;
  }

  // ========================================
  // معلومات القناة
  // ========================================

  const receivingChannel =
    post.chat?.title ||
    "Telegram";

  const receivingUsername =
    post.chat?.username ||
    "";

  console.log(
    `Telegram update ${update.update_id} من: ${receivingChannel}`
  );

  console.log(
    `Username: @${receivingUsername || "غير معروف"}`
  );

  // ========================================
  // النص
  // ========================================

  const postText =
    post.text ||
    post.caption ||
    "";

  if (!postText.trim()) {

    console.log(
      `Update ${update.update_id}: منشور بدون نص`
    );

    continue;
  }

  // ========================================
  // Metadata
  // ========================================

  const sourceMatch =
    postText.match(
      /<!--MOWJAZ_SOURCE:(.*?)-->/
    );

  const linkMatch =
    postText.match(
      /<!--MOWJAZ_LINK:(.*?)-->/
    );

  const metadataSource =
    sourceMatch?.[1]?.trim() ||
    "";

  const metadataLink =
    linkMatch?.[1]?.trim() ||
    "";

  console.log(
    `MOWJAZ_SOURCE: ${
      metadataSource || "غير موجود"
    }`
  );

  console.log(
    `MOWJAZ_LINK: ${
      metadataLink || "غير موجود"
    }`
  );

  // ========================================
  // تنظيف النص
  // ========================================

  const cleanText =
    postText
      .replace(
        /<!--[\s\S]*?-->/g,
        ""
      )
      .trim();

  const lines =
    cleanText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

  // ========================================
  // استخراج العنوان
  // ========================================

  let title = "";

  for (const line of lines) {

    if (
      line.startsWith("📰") ||
      line.startsWith("🔗") ||
      line.startsWith("http://") ||
      line.startsWith("https://")
    ) {
      continue;
    }

    if (
      line.length >= 15
    ) {
      title = line;
      break;
    }
  }

  // لو لم نجد عنوانًا مناسبًا
  if (!title) {
    title =
      lines[0] ||
      "خبر من Telegram";
  }

  title =
    title
      .replace(/^📰\s*/u, "")
      .replace(/^🔗\s*/u, "")
      .trim()
      .slice(0, 200);

  // ========================================
  // تجاهل الرسائل الاختبارية والفارغة
  // ========================================

  const badTitles = [
    "",
    "اليوم",
    "ايوه",
    "الاختبار الامثل",
    "الاختبار",
    "تجربة",
    "test",
    "hello"
  ];

  if (
    badTitles.includes(
      title.toLowerCase()
    )
  ) {

    console.log(
      `تم تجاهل رسالة اختبارية: ${title}`
    );

    continue;
  }

  // ========================================
  // الرابط
  // ========================================

  const messageId =
    post.message_id;

  const receivingLink =
    receivingUsername
      ? `https://t.me/${receivingUsername}/${messageId}`
      : "";

  const originalLink =
    metadataLink ||
    receivingLink;

  // ========================================
  // المصدر
  // ========================================

  let source =
    metadataSource ||
    receivingChannel;

  // تحويل المصدر الداخلي
  if (
    source === "RT_ARABIC"
  ) {
    source = "RT Arabic";
  }

  // ========================================
  // التاريخ
  // ========================================

  const date =
    new Date(
      post.date * 1000
    ).toISOString();

  // ========================================
  // الوصف
  // ========================================

  const description =
    cleanText.slice(0, 500);

  // ========================================
  // منع التكرار
  // ========================================

  const exists =
    telegramNews.some(item => {

      if (
        originalLink &&
        item.link === originalLink
      ) {
        return true;
      }

      if (
        item.telegramUpdateId ===
        update.update_id
      ) {
        return true;
      }

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

  // ========================================
  // التصنيف
  // ========================================

  let category = "العالم";

  const textForCategory =
    `${title} ${description}`;

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

  // ========================================
  // الخبر النهائي
  // ========================================

  const item = {

    title,

    link:
      originalLink,

    description,

    date,

    source,

    sourceScore:
      source === "RT Arabic"
        ? 10
        : 8,

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
    `✅ تمت إضافة خبر جديد: ${title}`
  );

  console.log(
    `المصدر: ${source}`
  );

  console.log(
    `الرابط: ${originalLink}`
  );
}

// ==========================================
// ترتيب Telegram من الأحدث إلى الأقدم
// ==========================================

telegramNews.sort(
  (a, b) =>
    new Date(b.date) -
    new Date(a.date)
);

// ==========================================
// الاحتفاظ بآخر 300 خبر
// ==========================================

telegramNews =
  telegramNews.slice(0, 300);

// ==========================================
// حفظ Telegram
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
// النتائج
// ==========================================

console.log(
  "================================"
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

console.log(
  `New offset: ${newOffset}`
);

console.log(
  "================================"
);
