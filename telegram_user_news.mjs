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
// القنوات المطلوب قراءتها فقط
// ==========================================
//
// ضع أسماء مستخدمي القنوات هنا بدون @
// مثال:
// RTarabic
//
// ويمكن إضافة أكثر من 20 قناة
// ==========================================

const TARGET_CHANNELS = [
  "RTarabic",

];

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
// دوال مساعدة
// ==========================================

function cleanText(text) {
  return String(text || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ==========================================
// التصنيف
// ==========================================

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

// ==========================================
// رابط Telegram
// ==========================================

function createTelegramLink(channel, messageId) {

  if (channel.username) {
    return `https://t.me/${channel.username}/${messageId}`;
  }

  const channelId =
    String(channel.id);

  return `https://t.me/c/${channelId}/${messageId}`;
}

// ==========================================
// الاتصال
// ==========================================

console.log("================================");
console.log("بدء الاتصال بحساب Telegram...");
console.log("================================");

await client.connect();

const authorized =
  await client.checkAuthorization();

if (!authorized) {
  throw new Error(
    "جلسة Telegram غير صالحة أو انتهت."
  );
}

console.log(
  "✅ تم الاتصال بحساب Telegram بنجاح"
);

// ==========================================
// قراءة الأخبار السابقة
// ==========================================

let telegramNews = [];

if (fs.existsSync(telegramFile)) {

  try {

    const saved =
      JSON.parse(
        fs.readFileSync(
          telegramFile,
          "utf8"
        )
      );

    telegramNews =
      Array.isArray(saved)
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
// التحقق من قائمة القنوات
// ==========================================

if (
  !Array.isArray(TARGET_CHANNELS) ||
  TARGET_CHANNELS.length === 0
) {

  throw new Error(
    "لم يتم تحديد أي قناة في TARGET_CHANNELS"
  );
}

console.log("");
console.log("القنوات المطلوبة فقط:");
console.log("");

for (const username of TARGET_CHANNELS) {

  console.log(
    `📡 @${username}`
  );
}

console.log("");
console.log(
  `إجمالي القنوات المطلوبة: ${TARGET_CHANNELS.length}`
);
console.log("");

// ==========================================
// قراءة القنوات المطلوبة فقط
// ==========================================

let channels = [];

for (const username of TARGET_CHANNELS) {

  try {

    const entity =
      await client.getEntity(
        `@${username}`
      );

    if (!entity) {

      console.log(
        `⚠️ لم يتم العثور على @${username}`
      );

      continue;
    }

    if (
      !(entity instanceof Api.Channel)
    ) {

      console.log(
        `⚠️ @${username} ليس قناة Telegram`
      );

      continue;
    }

    channels.push({

      entity,

      title:
        entity.title ||
        username,

      username:
        entity.username ||
        username,

      id:
        entity.id
    });

    console.log(
      `✅ تم العثور على: ${
        entity.title || username
      }`
    );

  } catch (error) {

    console.log(
      `⚠️ تعذر الوصول إلى @${username}`
    );

    console.log(
      error.message
    );
  }
}

// ==========================================
// لا توجد قنوات
// ==========================================

if (channels.length === 0) {

  throw new Error(
    "لم يتم العثور على أي قناة من القائمة المحددة."
  );
}

console.log("");
console.log(
  `📡 سيتم قراءة ${channels.length} قناة فقط`
);
console.log("");

// ==========================================
// قراءة الأخبار
// ==========================================

let added = 0;

for (const channel of channels) {

  console.log("");
  console.log(
    "================================"
  );

  console.log(
    `📡 قراءة القناة: ${channel.title}`
  );

  console.log(
    `Username: @${channel.username}`
  );

  console.log(
    "================================"
  );

  try {

    // آخر 30 منشورًا فقط
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
          .map(
            line => line.trim()
          )
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
          .replace(
            /^📰\s*/u,
            ""
          )
          .replace(
            /^🔗\s*/u,
            ""
          )
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
      // رابط الخبر
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
        telegramNews.some(
          item => {

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
          }
        );

      if (exists) {

        continue;
      }

      // ====================================
      // الخبر النهائي
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
          channel.username === "RTarabic_br"
            ? 10
            : 8,

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
            `@${channel.username}`
          ],

        telegramChannelId:
          String(channel.id),

        telegramMessageId:
          message.id,

        telegramChannelUsername:
          channel.username
      };

      telegramNews.unshift(item);

      added++;

      console.log(
        `  ✅ ${title.slice(0, 100)}`
      );
    }

  } catch (error) {

    console.log(
      `⚠️ تعذر قراءة ${channel.title}`
    );

    console.log(
      error.message
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
  `القنوات المطلوبة: ${TARGET_CHANNELS.length}`
);

console.log(
  `القنوات التي تم الوصول إليها: ${channels.length}`
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
