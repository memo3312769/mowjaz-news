import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";
import fs from "node:fs";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  throw new Error("TELEGRAM_API_ID أو TELEGRAM_API_HASH غير موجود");
}

const stringSession = new StringSession("");

const client = new TelegramClient(
  stringSession,
  apiId,
  apiHash,
  {
    connectionRetries: 5,
  }
);

console.log("بدء تسجيل الدخول إلى Telegram...");

await client.start({
  phoneNumber: async () => await input.text("رقم Telegram: "),
  password: async () => await input.text("كلمة مرور التحقق بخطوتين: "),
  phoneCode: async () => await input.text("كود Telegram: "),
  onError: (err) => console.log("خطأ:", err),
});

console.log("TELEGRAM_SESSION:");

const session = stringSession.save();

console.log(session);
fs.writeFileSync(".telegram_session.txt", session, "utf8");

console.log("\nتم حفظ الـSession في ملف .telegram_session.txt");

await client.disconnect();