import fs from "fs";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

// ==========================================
// Telegram Environment Variables
// ==========================================

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const sessionString = process.env.TELEGRAM_SESSION;

if (!apiId || !apiHash || !sessionString) {
  throw new Error(
    "TELEGRAM_API_ID أو TELEGRAM_API_HASH أو TELEGRAM_SESSION مفقود"
  );
}

// ==========================================
// الملفات
// ==========================================

const telegramFile = "telegram_news.json";

// ==========================================
// إنشاء Telegram Client
// ==========================================

const stringSession = new StringSession(sessionString);

const client = new TelegramClient(
  stringSession,
  apiId,
  apiHash,
  {
    connectionRetries: 5,
  }
);

// ==========================================
// الاتصال بالحساب
// ==========================================

console.log("================================");
console.log("بدء الاتصال بحساب Telegram...");
console.log("================================");

await client.connect();

const authorized = await client.checkAuthorization();

if (!authorized) {
  throw new Error(
    "جلسة Telegram غير صالحة أو انتهت. نحتاج تسجيل الدخول مرة أخرى."
  );
}

console.log("✅ تم الاتصال بحساب Telegram بنجاح");

// ==========================================
// قراءة الأخبار السابقة
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

console.log(
  `الأخبار الموجودة مسبقًا: ${telegramNews.length}`
);

// ==========================================
// الحصول على القنوات
// ==========================================

console.log("");
console.log("جاري قراءة قنوات Telegram...");
console.log("");

const dialogs = await client.getDialogs({
  limit: 1000
});

const channels = [];

for (const dialog of dialogs) {

  const entity = dialog.entity;

  if (!entity) {
    continue;
  }

  // القنوات فقط
  if (
    entity instanceof Api.Channel &&
    entity.broadcast === true
  ) {
    channels.push({
      entity,
      title:
        entity.title ||
        "Telegram",

      username:
        entity.username ||
        "",

      id:
        entity.id
    });
  }
}

console.log(
  `📡 تم العثور على ${channels.length} قناة`
);

console.log("");

// ==========================================
// دوال مساعدة
// ==========================================

function cleanText(text) {

  return String(text || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


function detectCategory(text) {

  if (
    /مصر|القاهرة|الحكومة المصرية|الرئيس المصري|وزارة الداخلية|وزارة الخارجية/
      .test(text)
  ) {
    return "مصر";
  }

  if (
    /اقتصاد|اقتصادية|أسواق|نفط|دولار|ذهب|بنك|بورصة|استثمار/
      .test(text)
  ) {
    return "اقتصاد";
  }

  if (
    /رياضة|كرة|مباراة|دوري|منتخب|أهلي|زمالك/
      .test(text)
  ) {
    return "رياضة";
  }

  if (
    /تكنولوجيا|تقنية|ذكاء اصطناعي|هاتف|آيفون|سامسونج|جوجل/
      .test(text)
  ) {
    return "تكنولوجيا";
  }

  if (
    /علوم|فضاء|علماء|ناسا|اكتشاف علمي/
      .test(text)
  ) {
    return "علوم";
  }

  return "العالم";
}


function createTelegramLink(channel, messageId) {

  if (channel.username) {
    return `https://t.me/${channel.username}/${messageId}`;
  }

  // للقنوات الخاصة التي لا تملك username
  const channelId =
    String(channel.id);

  return `https://t.me/c/${channelId}/${messageId}`;
}


// ==========================================
// قراءة الأخبار من القنوات
// ==========================================

let added = 0;

for (const channel of channels) {

  console.log(
    `📡 قراءة: ${channel.title}` +
    (
      channel.username
        ? ` (@${channel.username})`
        : ""
    )
  );

  try {

    // آخر 30 منشورًا من كل قناة
    for await (
      const message of client.iterMessages(
        channel.entity,
        {
          limit: 30
        }
      )
    ) {

      if (!message) {
        continue;
      }

      const rawText =
        message.message ||
        "";

      const text =
        cleanText(rawText);

      if (!text) {
        continue;
      }

      // ====================================
      // استخراج العنوان
      // ====================================

      const lines =
        text
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean);

      let title = "";

      for (const line of lines) {

        if (
          line.startsWith("http://") ||
          line.startsWith("https://") ||
          line.length < 15
        ) {
          continue;
        }

        title = line;
        break;
      }

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

      // ====================================
      // تجاهل الاختبارات
      // ====================================

      const badTitles = [
        "",
        "hello",
        "test",
        "تجربة",
        "اختبار",
        "الاختبار",
        "ايوه"
      ];

      if (
        badTitles.includes(
          title.toLowerCase()
        )
      ) {
        continue;
      }

      // ====================================
      // الرابط
      // ====================================

      const link =
        createTelegramLink(
          channel,
          message.id
        );

      // ====================================
      // التاريخ
      // ====================================

      const date =
        message.date
          ? new Date(
              message.date
            ).toISOString()
          : new Date().toISOString();

      // ====================================
      // التصنيف
      // ====================================

      const category =
        detectCategory(
          `${title} ${text}`
        );

      // ====================================
      // منع التكرار
      // ====================================

      const exists =
        telegramNews.some(item => {

          if (
            item.link &&
            item.link === link
          ) {
            return true;
          }

          if (
            item.telegramChannelId ===
              String(channel.id) &&
            item.telegramMessageId ===
              message.id
          ) {
            return true;
          }

          return false;
        });

      if (exists) {
        continue;
      }

      // ====================================
      // إنشاء الخبر
      // ====================================

      const item = {

        title,

        link,

        description:
          text.slice(0, 500),

        date,

        source:
          channel.title,

        sourceScore:
          8,

        sourceType:
          "telegram_user",

        cat:
          category,

        image:
          "",

        sourceCount:
          1,

        sources:
          [
            channel.username
              ? `@${channel.username}`
              : channel.title
          ],

        telegramChannelId:
          String(channel.id),

        telegramMessageId:
          message.id,

        telegramChannelUsername:
          channel.username || ""
      };

      telegramNews.unshift(item);

      added++;

      console.log(
        `  ✅ ${title.slice(0, 90)}`
      );
    }

  } catch (error) {

    console.log(
      `  ⚠️ تعذر قراءة ${channel.title}`
    );

    console.log(
      `  ${error.message}`
    );
  }
}

// ==========================================
// ترتيب الأخبار
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
// حفظ الملف
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
// إنهاء الاتصال
// ==========================================

await client.disconnect();

// ==========================================
// النتيجة
// ==========================================

console.log("");
console.log("================================");
console.log("        النتيجة النهائية");
console.log("================================");

console.log(
  `القنوات المقروءة: ${channels.length}`
);

console.log(
  `أخبار جديدة: ${added}`
);

console.log(
  `إجمالي أخبار Telegram: ${telegramNews.length}`
);

console.log(
  "تم حفظ الأخبار في telegram_news.json"
);

console.log("================================");