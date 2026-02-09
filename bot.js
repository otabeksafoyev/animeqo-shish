// bot.js
// Telegram bot — videolarni seriya sifatida kanalga yuklash va elon tashlash
// 2025–2026 versiya | boshlang'ich va oxirgi qism raqamini tanlash imkoni bilan, kanal tanlash va elon funksiyasi qo'shilgan

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ────────────────────────────────────────────────
// BU YERDA O'Z MA'LUMOTlaringizNI KIRITING
// ────────────────────────────────────────────────
const BOT_TOKEN = '8431728057:AAFxvs9LUrHNfA4eWFmqQY52T6-DTuhibjg'; // ← BOT TOKEN
const ADMIN_ID = 8173188671; // ← SIZNING TELEGRAM ID'ingiz
const DEFAULT_CHANNEL_ID = '@kinochidb'; // Boshlang'ich kanal, agar saqlanmagan bo'lsa

// ────────────────────────────────────────────────
// PASTKI KODNI O'ZGARTIRMANG (agar kerak bo'lmasa)
// ────────────────────────────────────────────────

if (!BOT_TOKEN || !ADMIN_ID) {
  console.error('\n❌ Kod ichidagi BOT_TOKEN yoki ADMIN_ID to‘ldirilmagan!');
  console.error('Iltimos, yuqoridagi 2 ta o‘zgaruvchini to‘g‘ri to‘ldiring.\n');
  process.exit(1);
}

console.log(`Bot ishga tushdi | Admin: ${ADMIN_ID}`);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
let botId = null; // Botning o'z ID'si

bot.getMe().then(me => {
  botId = me.id;
  console.log(`Bot ID: ${botId}`);
}).catch(err => {
  console.error('Bot haqida ma\'lumot olishda xato:', err);
  process.exit(1);
});

const DATA_FILE = 'data.json';
let state = {
  channelId: DEFAULT_CHANNEL_ID,
  currentId: '',
  startPart: 1,
  endPart: 0,
  currentPart: 0,
  announceLink: '',
  mode: 'idle' // idle | waiting_channel_choice | waiting_new_channel | waiting_id | waiting_start | waiting_end | waiting_videos | waiting_announce_link | waiting_announces
};

function load() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      Object.assign(state, JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')));
      console.log('Oldingi holat yuklandi');
    } catch {}
  }
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      channelId: state.channelId,
      currentId: state.currentId,
      startPart: state.startPart,
      endPart: state.endPart,
      currentPart: state.currentPart,
      announceLink: state.announceLink,
      mode: state.mode
    }, null, 2));
  } catch {}
}

load();

// ───────────── Buyruqlar ─────────────

// /start buyrug'i — buttonlar chiqarish
bot.onText(/\/start/i, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  const keyboard = {
    reply_markup: {
      keyboard: [
        ['Add ID'],
        ['Elon tashlash']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };

  bot.sendMessage(msg.chat.id, 'Xush kelibsiz! Funksiyani tanlang:', keyboard);
});

// Umumiy message handler
bot.on('message', (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  const cid = msg.chat.id;
  const text = msg.text ? msg.text.trim() : '';

  // Buttonlar orqali funksiyalar
  if (text === 'Add ID') {
    const keyboard = {
      reply_markup: {
        keyboard: [
          ['Avvalgi kanal'],
          ['Yangi kanal']
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };
    bot.sendMessage(cid, `Hozirgi kanal: ${state.channelId}\nAvvalgi kanalda qolasizmi yoki yangisini tanlaysizmi?`, keyboard);
    state.mode = 'waiting_channel_choice';
    save();
    return;
  } else if (text === 'Elon tashlash') {
    if (!state.announceLink) {
      bot.sendMessage(cid, 'Avval linkni kiriting (masalan: https://t.me/joinchat/AAAAAEvwxYIEk9QmDCGMNw)');
      state.mode = 'waiting_announce_link';
      save();
      return;
    } else {
      bot.sendMessage(cid, 'Endi elon rasmi va matnini yuboring (photo + caption shaklida).');
      state.mode = 'waiting_announces';
      save();
      return;
    }
  }

  // Kanal tanlash jarayoni
  if (state.mode === 'waiting_channel_choice') {
    if (text === 'Avvalgi kanal') {
      bot.sendMessage(cid, `OK, avvalgi kanal (${state.channelId}) da davom etamiz.\nID ni yuboring (masalan: uuid, anime nomi, serial kodi...)`);
      state.mode = 'waiting_id';
      save();
      return;
    } else if (text === 'Yangi kanal') {
      bot.sendMessage(cid, 'Yangi kanal linkini yuboring (masalan: @channelname yoki -1001234567890)');
      state.mode = 'waiting_new_channel';
      save();
      return;
    } else {
      bot.sendMessage(cid, 'Iltimos, buttonlardan birini bosing.');
      return;
    }
  }

  // Yangi kanal qabul qilish va tekshirish
  if (state.mode === 'waiting_new_channel' && text) {
    const newChannelId = text.startsWith('@') ? text : text; // @ yoki raqamli ID
    // Bot admin ekanligini tekshirish
    bot.getChatMember(newChannelId, botId).then(member => {
      if (member.status === 'administrator') {
        state.channelId = newChannelId;
        bot.sendMessage(cid, `✅ Yangi kanal (${state.channelId}) qabul qilindi va bot admin ekanligi tasdiqlandi.\nEndi ID ni yuboring.`);
        state.mode = 'waiting_id';
        save();
      } else {
        bot.sendMessage(cid, '❌ Bot bu kanalda admin emas. Avval botni admin qilib qo\'shing va qaytadan urinib ko\'ring.');
      }
    }).catch(err => {
      console.error(err);
      bot.sendMessage(cid, 'Kanalni tekshirishda xato: ' + err.message + '\nTo\'g\'ri ID yoki @channelname kiriting.');
    });
    return;
  }

  // Add ID jarayoni (avvalgi kabi)
  // 1. ID kiritish
  if (state.mode === 'waiting_id' && text) {
    state.currentId = text;
    state.mode = 'waiting_start';
    bot.sendMessage(cid, 'Qaysi raqamdan boshlaymiz? (masalan: 1 yoki 20)');
    save();
    return;
  }

  // 2. Boshlang'ich qism raqami
  if (state.mode === 'waiting_start' && text) {
    const start = parseInt(text);
    if (!Number.isInteger(start) || start < 1) {
      bot.sendMessage(cid, 'Iltimos, 1 yoki undan katta butun son kiriting.');
      return;
    }
    state.startPart = start;
    state.currentPart = start;
    state.mode = 'waiting_end';
    bot.sendMessage(cid, 'Qaysi raqam bilan tugatamiz? (masalan: 12 yoki 50)');
    save();
    return;
  }

  // 3. Oxirgi qism raqami
  if (state.mode === 'waiting_end' && text) {
    const end = parseInt(text);
    if (!Number.isInteger(end) || end < state.startPart) {
      bot.sendMessage(cid, `Oxirgi qism boshlang'ichdan katta bo‘lishi kerak.\nHozirgi start: ${state.startPart}`);
      return;
    }
    state.endPart = end;
    state.mode = 'waiting_videos';
    const total = end - state.startPart + 1;
    bot.sendMessage(cid, `✅ Seriya boshlandi!\n` +
      `ID: ${state.currentId}\n` +
      `Qismlar: ${state.startPart} dan ${state.endPart} gacha (${total} ta)\n\n` +
      `Endi videolarni ketma-ket yuboring...\n\n` +
      `Keyingi kutilyapti: ${state.currentPart}-qism`
    );
    save();
    return;
  }

  // 4. Video qabul qilish
  if (msg.video && state.mode === 'waiting_videos' && state.currentId && state.currentPart <= state.endPart) {
    const caption = `ID: ${state.currentId}\nQism: ${state.currentPart}`;
    bot.sendVideo(state.channelId, msg.video.file_id, { caption })
      .then(() => {
        bot.sendMessage(cid, `Qism ${state.currentPart} → kanalga yuklandi`);
      })
      .catch(err => {
        console.error(err);
        bot.sendMessage(cid, 'Videoni kanalga yuborib bo‘lmadi.\nBot kanal admin ekanligini tekshiring.');
      });
    state.currentPart++;
    save();
    if (state.currentPart > state.endPart) {
      bot.sendMessage(cid, 'Barcha qismlar yuklandi ✅');
      state.mode = 'idle';
      save();
    } else {
      bot.sendMessage(cid, `Keyingi kutilyapti: ${state.currentPart}-qism`);
    }
    return;
  }

  // Elon tashlash jarayoni
  // 1. Link kiritish
  if (state.mode === 'waiting_announce_link' && text) {
    if (!text.startsWith('https://t.me/')) {
      bot.sendMessage(cid, 'Iltimos, to\'g\'ri Telegram linkini kiriting (https://t.me/... shaklida).');
      return;
    }
    state.announceLink = text;
    bot.sendMessage(cid, `✅ Link saqlandi: ${state.announceLink}\nEndi elon rasmi va matnini yuboring (photo + caption shaklida).`);
    state.mode = 'waiting_announces';
    save();
    return;
  }

  // 2. Elon qabul qilish (photo + caption)
  if (msg.photo && msg.caption && state.mode === 'waiting_announces') {
    const photoId = msg.photo[msg.photo.length - 1].file_id; // Eng katta rasm
    let caption = msg.caption;

    // Oxirgi linkni topib, yangisi bilan almashtirish
    const linkRegex = /https:\/\/t\.me\/[^\s]+$/;
    caption = caption.replace(linkRegex, state.announceLink);

    bot.sendPhoto(state.channelId, photoId, { caption })
      .then(() => {
        bot.sendMessage(cid, 'Elon kanalga yuklandi ✅');
      })
      .catch(err => {
        console.error(err);
        bot.sendMessage(cid, 'Elonni kanalga yuborib bo‘lmadi.\nBot kanal admin ekanligini tekshiring.');
      });

    // Keyingi elonlarni kutish
    bot.sendMessage(cid, 'Yana elon yuborishingiz mumkin yoki /start bilan bosh menyuga qayting.');
    return;
  }

  // Agar boshqa xabar kelsa va rejim faol bo‘lsa
  if (state.mode !== 'idle') {
    bot.sendMessage(cid, 'Hozirgi rejimda to\'g\'ri ma\'lumot kiriting. Agar xato bo\'lsa, /start bilan qaytadan boshlang.');
  }
});

console.log('Bot faol — xabarlarni kutmoqda...');