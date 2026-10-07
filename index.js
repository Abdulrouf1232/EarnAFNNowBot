const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;

// ستا درې اجباري ځایونه
const REQUIRED_CHATS = [
  { id: "@Azad_coin12", name: "Azad Coin Group", url: "https://t.me/Azad_coin12" },
  { id: "@Azadcoinche", name: "Azad Coin Channel", url: "https://t.me/Azadcoinche" },
  { id: "@EarnAFNWithdraw", name: "Withdrawal Channel", url: "https://t.me/EarnAFNWithdraw" }
];

// خپل Telegram ID دلته ولیکه
const ADMIN_ID = Number(process.env.ADMIN_ID || 0);

if (!BOT_TOKEN) {
  console.log("BOT_TOKEN is missing!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const DB_FILE = "./database.json";

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: {}, withdrawals: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { users: {}, withdrawals: [] };
  }
}

let db = loadDB();

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getUser(ctx) {
  const id = String(ctx.from.id);

  if (!db.users[id]) {
    db.users[id] = {
      id: ctx.from.id,
      name: ctx.from.first_name || "",
      username: ctx.from.username || "",
      balance: 0,
      referrals: 0,
      referredBy: null,
      createdAt: new Date().toISOString()
    };

    saveDB();
  }

  return db.users[id];
}

// اجباري ګډون
async function checkMembership(ctx) {
  const userId = ctx.from.id;

  for (const chat of REQUIRED_CHATS) {
    try {
      const member = await ctx.telegram.getChatMember(chat.id, userId);

      if (
        member.status === "left" ||
        member.status === "kicked"
      ) {
        return false;
      }
    } catch (error) {
      console.log("Membership check error:", chat.id, error.message);
      return false;
    }
  }

  return true;
}

function joinKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.url("👥 Join Group", REQUIRED_CHATS[0].url)],
    [Markup.button.url("📢 Join Channel", REQUIRED_CHATS[1].url)],
    [Markup.button.url("💸 Withdrawal Channel", REQUIRED_CHATS[2].url)],
    [Markup.button.callback("✅ Check Membership", "check_membership")]
  ]);
}

async function requireMembership(ctx) {
  const ok = await checkMembership(ctx);

  if (!ok) {
    await ctx.reply(
      "🇦🇫 **Earn AFN**\n\n" +
      "د بوټ د استعمال لپاره باید لومړی په ټولو درې ځایونو کې ګډون وکړئ 👇\n\n" +
      "1️⃣ Group\n" +
      "2️⃣ Channel\n" +
      "3️⃣ Withdrawal Channel\n\n" +
      "وروسته د **Check Membership** تڼۍ کېکاږئ.",
      {
        parse_mode: "Markdown",
        ...joinKeyboard()
      }
    );

    return false;
  }

  return true;
}

// START
bot.start(async (ctx) => {
  const user = getUser(ctx);

  // Referral
  const startPayload = ctx.startPayload;

  if (
    startPayload &&
    startPayload.startsWith("ref_")
  ) {
    const refId = startPayload.replace("ref_", "");

    if (
      refId !== String(ctx.from.id) &&
      !user.referredBy &&
      db.users[refId]
    ) {
      user.referredBy = refId;
      db.users[refId].referrals += 1;

      // د ریفرل اندازه دلته بدلولی شې
      db.users[refId].balance += 2;

      saveDB();
    }
  }

  const joined = await checkMembership(ctx);

  if (!joined) {
    return ctx.reply(
      "🇦🇫 **Earn AFN** 💰\n\n" +
      "ښه راغلاست!\n\n" +
      "د بوټ د کارولو لپاره لومړی لاندې درې ځایونو کې ګډون وکړئ:",
      {
        parse_mode: "Markdown",
        ...joinKeyboard()
      }
    );
  }

  await showMainMenu(ctx);
});

// اصلي Menu
async function showMainMenu(ctx) {
  await ctx.reply(
    "🇦🇫 **Earn AFN**\n\n" +
    "💰 ستاسو حساب ته ښه راغلاست!\n\n" +
    "له لاندې انتخابونو څخه یو انتخاب کړئ:",
    {
      parse_mode: "Markdown",
      ...Markup.keyboard([
        ["💰 My Balance", "👥 Referral"],
        ["📢 Tasks", "💸 Withdraw"],
        ["👤 My Account", "📊 History"],
        ["ℹ️ Help"]
      ]).resize()
    }
  );
}

// Check membership
bot.action("check_membership", async (ctx) => {
  await ctx.answerCbQuery();

  const joined = await checkMembership(ctx);

  if (!joined) {
    return ctx.reply(
      "❌ لا تر اوسه ټول ځایونه نه دي بشپړ شوي.\n\n" +
      "مهرباني وکړئ په ټولو درې ځایونو کې ګډون وکړئ.",
      joinKeyboard()
    );
  }

  await ctx.reply(
    "✅ مبارک!\n\nټول اجباري ګډونونه تایید شول. 🎉"
  );

  await showMainMenu(ctx);
});

// Balance
bot.hears("💰 My Balance", async (ctx) => {
  if (!(await requireMembership(ctx))) return;

  const user = getUser(ctx);

  await ctx.reply(
    `💰 ستاسو بیلانس:\n\n` +
    `🇦🇫 **${user.balance.toFixed(2)} AFN**`,
    { parse_mode: "Markdown" }
  );
});

// Referral
bot.hears("👥 Referral", async (ctx) => {
  if (!(await requireMembership(ctx))) return;

  const user = getUser(ctx);

  const link =
    `https://t.me/EarnAFNNowBot?start=ref_${ctx.from.id}`;

  await ctx.reply(
    `👥 **Referral System**\n\n` +
    `ستاسو Referral لینک:\n\n` +
    `${link}\n\n` +
    `👤 Referral Count: ${user.referrals}\n` +
    `💰 Referral Earnings: ${(user.referrals * 2).toFixed(2)} AFN`,
    { parse_mode: "Markdown" }
  );
});

// Tasks
bot.hears("📢 Tasks", async (ctx) => {
  if (!(await requireMembership(ctx))) return;

  await ctx.reply(
    "📢 **Tasks**\n\n" +
    "اوس مهال کوم فعال Task نشته.\n\n" +
    "کله چې نوی اعلان یا Task اضافه شي، دلته به ښکاره شي.",
    { parse_mode: "Markdown" }
  );
});

// Account
bot.hears("👤 My Account", async (ctx) => {
  if (!(await requireMembership(ctx))) return;

  const user = getUser(ctx);

  await ctx.reply(
    `👤 **My Account**\n\n` +
    `🆔 ID: ${user.id}\n` +
    `👤 Name: ${user.name}\n` +
    `🔗 Username: @${user.username || "None"}\n` +
    `💰 Balance: ${user.balance.toFixed(2)} AFN\n` +
    `👥 Referrals: ${user.referrals}`,
    { parse_mode: "Markdown" }
  );
});

// Withdraw
bot.hears("💸 Withdraw", async (ctx) => {
  if (!(await requireMembership(ctx))) return;

  const user = getUser(ctx);

  if (user.balance < 30) {
    return ctx.reply(
      `❌ د Withdrawal لپاره لږ تر لږه 30 AFN ته اړتیا ده.\n\n` +
      `💰 ستاسو اوسنی بیلانس: ${user.balance.toFixed(2)} AFN`
    );
  }

  user.withdrawStep = "amount";
  saveDB();

  await ctx.reply(
    "💸 **Withdrawal**\n\n" +
    "مهرباني وکړئ د ایستلو اندازه ولیکئ.\n\n" +
    "مثال: `30`",
    { parse_mode: "Markdown" }
  );
});

// History
bot.hears("📊 History", async (ctx) => {
  if (!(await requireMembership(ctx))) return;

  const userId = ctx.from.id;

  const withdrawals = db.withdrawals.filter(
    x => x.userId === userId
  );

  if (!withdrawals.length) {
    return ctx.reply("📊 تر اوسه ستاسو د Withdrawal تاریخ خالي دی.");
  }

  let text = "📊 **Withdrawal History**\n\n";

  withdrawals.slice(-10).reverse().forEach((w, i) => {
    text += `${i + 1}. ${w.amount} AFN — ${w.status}\n`;
  });

  await ctx.reply(text, { parse_mode: "Markdown" });
});

// Help
bot.hears("ℹ️ Help", async (ctx) => {
  await ctx.reply(
    "ℹ️ **Earn AFN Help**\n\n" +
    "💰 Balance — خپل بیلانس وګورئ\n" +
    "👥 Referral — خپل Referral لینک واخلئ\n" +
    "📢 Tasks — فعال Tasks وګورئ\n" +
    "💸 Withdraw — د پیسو ایستلو غوښتنه وکړئ\n" +
    "👤 Account — خپل معلومات وګورئ\n" +
    "📊 History — د Withdrawal تاریخ وګورئ",
    { parse_mode: "Markdown" }
  );
});

// د Withdrawal معلومات
bot.on("text", async (ctx) => {
  const user = getUser(ctx);

  if (!user.withdrawStep) return;

  if (user.withdrawStep === "amount") {
    const amount = Number(ctx.message.text);

    if (!Number.isFinite(amount) || amount < 30) {
      return ctx.reply("❌ لږ تر لږه 30 AFN ولیکئ.");
    }

    if (amount > user.balance) {
      return ctx.reply("❌ ستاسو بیلانس د دې اندازې لپاره کافي نه دی.");
    }

    user.withdrawAmount = amount;
    user.withdrawStep = "account";

    saveDB();

    return ctx.reply(
      "📱 اوس خپل د پیسو ترلاسه کولو حساب/موبایل نمبر ولیکئ."
    );
  }

  if (user.withdrawStep === "account") {
    const account = ctx.message.text;

    const amount = user.withdrawAmount;

    user.balance -= amount;

    user.withdrawStep = null;
    user.withdrawAmount = null;

    const withdrawal = {
      id: Date.now(),
      userId: ctx.from.id,
      name: ctx.from.first_name || "",
      username: ctx.from.username || "",
      amount,
      account,
      status: "Pending",
      date: new Date().toISOString()
    };

    db.withdrawals.push(withdrawal);

    saveDB();

    await ctx.reply(
      "✅ **Withdrawal Request Submitted**\n\n" +
      `💰 Amount: ${amount} AFN\n` +
      `📱 Account: ${account}\n` +
      `⏳ Status: Pending\n\n` +
      "ستاسو غوښتنه د Admin لخوا ارزول کېږي.",
      { parse_mode: "Markdown" }
    );

    // Admin notification
    if (ADMIN_ID) {
      await bot.telegram.sendMessage(
        ADMIN_ID,
        `💸 **New Withdrawal Request**\n\n` +
        `👤 User: ${ctx.from.first_name || ""}\n` +
        `🆔 ID: ${ctx.from.id}\n` +
        `💰 Amount: ${amount} AFN\n` +
        `📱 Account: ${account}\n` +
        `⏳ Status: Pending`,
        { parse_mode: "Markdown" }
      );
    }
  }
});

// Admin statistics
bot.command("admin", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply("❌ تاسو Admin نه یاست.");
  }

  const users = Object.keys(db.users).length;

  const pending = db.withdrawals.filter(
    x => x.status === "Pending"
  ).length;

  await ctx.reply(
    `🛠️ **Admin Panel**\n\n` +
    `👥 Users: ${users}\n` +
    `💸 Withdrawals: ${db.withdrawals.length}\n` +
    `⏳ Pending: ${pending}`,
    { parse_mode: "Markdown" }
  );
});

// Error handling
bot.catch((err) => {
  console.log("Bot Error:", err.message);
});

// Start
bot.launch();

console.log("🇦🇫 EarnAFNNowBot is running...");

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
