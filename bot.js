// bot.js
// Telegram bot — videolarni seriya sifatida kanalga yuklash va elon tashlash
// Yangilangan: Elon captionidagi barcha t.me linklari kanal linkiga almashtiriladi

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ────────────────────────────────────────────────
// O'Z MA'LUMOTlaringizNI BU YERDA KIRITING
// ────────────────────────────────────────────────
const BOT_TOKEN = '8431728057:AAFxvs9LUrHNfA4eWFmqQY52T6-DTuhibjg';
const ADMIN_ID = 8173188671;
const DEFAULT_CHANNEL_ID = '@kinochidb';

// ────────────────────────────────────────────────
// PASTKI KODNI O'ZGARTIRMANG (agar chindan kerak bo'lmasa)
// ────────────────────────────────────────────────

if (!BOT_TOKEN || !ADMIN_ID) {
  console.error('\n❌ BOT_TOKEN yoki ADMIN_ID to‘ldirilmagan!\n');
  process.exit(1);
}

console.log(`Bot ishga tushdi | Admin: ${ADMIN_ID}`);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
let botId = null;

bot.getMe().then(me => {
  botId = me.id;
  console.log(`Bot ID: ${botId}`);
}).catch(err => {
  console.error('Bot ID olishda xato:', err);
  process.exit(1);
});

const DATA_FILE = 'data.json';

let state = {
  channelId: DEFAULT_CHANNEL_ID,
  currentId: '',
  startPart: 1,
  endPart: 0,
  currentPart: 0,
  mode: 'idle'
};

function loadState() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      Object.assign(state, JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')));
      console.log('Oldingi holat yuklandi');
    } catch (e) {
      console.error('data.json o‘qishda xato:', e.message);
    }
  }
}

function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      channelId: state.channelId,
      currentId: state.currentId,
      startPart: state.startPart,
      endPart: state.endPart,
      currentPart: state.currentPart,
      mode: state.mode
    }, null, 2));
  } catch (e) {
    console.error('data.json saqlashda xato:', e.message);
  }
}

loadState();

// ───────────── Buyruqlar va tugmalar ─────────────

bot.onText(/\/start/i, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  bot.sendMessage(msg.chat.id, 'Xush kelibsiz! Nima qilamiz?', {
    reply_markup: {
      keyboard: [
        ['Add ID'],
        ['Change Channel'],
        ['Elon tashlash'],
        ['Bekor qilish']
      ],
      resize_keyboard: true
    }
  });
});

bot.onText(/\/addid/i, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  startAddSeries(msg.chat.id);
});

bot.onText(/\/elon/i, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  startAnnounce(msg.chat.id);
});

bot.onText(/\/cancel|\/bekor/i, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  resetState(msg.chat.id);
});

bot.on('message', (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  const cid = msg.chat.id;
  const text = (msg.text || '').trim();

  // Tugmalar
  if (text === 'Add ID') {
    startAddSeries(cid);
    return;
  }

  if (text === 'Change Channel') {
    bot.sendMessage(cid, `Hozirgi kanal: ${state.channelId}\nQaysi kanal bilan ishlaymiz?`, {
      reply_markup: {
        keyboard: [
          ['Avvalgi kanal'],
          ['Yangi kanal']
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    state.mode = 'waiting_channel_choice';
    saveState();
    return;
  }

  if (text === 'Elon tashlash') {
    startAnnounce(cid);
    return;
  }

  if (text === 'Bekor qilish') {
    resetState(cid);
    return;
  }

  // ─── Rejimlar bo‘yicha ishlov ───

  if (state.mode === 'waiting_channel_choice') {
    if (text === 'Avvalgi kanal') {
      bot.sendMessage(cid, `OK, ${state.channelId} da davom etamiz.\n/start bilan bosh menyuga qaytishingiz mumkin.`);
      state.mode = 'idle';
      saveState();
    } else if (text === 'Yangi kanal') {
      bot.sendMessage(cid, 'Yangi kanal @username yoki -100XXXXXXXX shaklida yuboring:');
      state.mode = 'waiting_new_channel';
      saveState();
    } else {
      bot.sendMessage(cid, 'Iltimos, tugmalardan birini tanlang.');
    }
    return;
  }

  if (state.mode === 'waiting_new_channel' && text) {
    const newId = text;
    bot.getChatMember(newId, botId)
      .then(member => {
        if (['administrator', 'creator'].includes(member.status)) {
          state.channelId = newId;
          bot.sendMessage(cid, `✅ Kanal o‘zgartirildi: ${state.channelId}\nBot admin tasdiqlandi.`);
          state.mode = 'idle';
          saveState();
        } else {
          bot.sendMessage(cid, '❌ Bot bu kanalda admin emas. Avval admin qilib qo‘shing.');
        }
      })
      .catch(err => {
        bot.sendMessage(cid, `Xato: ${err.message}\nTo‘g‘ri kanal ID yoki @username kiriting.`);
      });
    return;
  }

  // Seriya qo‘shish jarayoni
  if (state.mode === 'waiting_id' && text) {
    state.currentId = text;
    state.mode = 'waiting_start';
    bot.sendMessage(cid, 'Qaysi qismdan boshlaymiz? (masalan: 1)');
    saveState();
    return;
  }

  if (state.mode === 'waiting_start' && text) {
    const start = parseInt(text);
    if (!Number.isInteger(start) || start < 1) {
      return bot.sendMessage(cid, 'Iltimos, 1 yoki undan katta butun son kiriting.');
    }
    state.startPart = start;
    state.currentPart = start;
    state.mode = 'waiting_end';
    bot.sendMessage(cid, 'Qaysi qism bilan tugatamiz? (masalan: 24)');
    saveState();
    return;
  }

  if (state.mode === 'waiting_end' && text) {
    const end = parseInt(text);
    if (!Number.isInteger(end) || end < state.startPart) {
      return bot.sendMessage(cid, `Oxirgi qism startdan katta bo‘lishi kerak (hozir: ${state.startPart}).`);
    }
    state.endPart = end;
    state.mode = 'waiting_videos';
    const total = end - state.startPart + 1;
    bot.sendMessage(cid, `✅ Seriya boshlandi!\nID: ${state.currentId}\nQismlar: ${state.startPart} – ${end} (${total} ta)\n\nVideolarni ketma-ket yuboring...`);
    bot.sendMessage(cid, `Keyingi: ${state.currentPart}-qism kutilyapti`);
    saveState();
    return;
  }

  // Video yuklash
  if (msg.video && state.mode === 'waiting_videos' && state.currentPart <= state.endPart) {
    const caption = `ID: ${state.currentId}\nQism: ${state.currentPart}`;
    bot.sendVideo(state.channelId, msg.video.file_id, { caption })
      .then(() => bot.sendMessage(cid, `✔ Qism ${state.currentPart} yuklandi`))
      .catch(err => {
        console.error(err);
        bot.sendMessage(cid, 'Videoni kanalga yuborib bo‘lmadi. Bot adminligini tekshiring.');
      });

    state.currentPart++;
    saveState();

    if (state.currentPart > state.endPart) {
      bot.sendMessage(cid, 'Barcha qismlar yuklandi! ✅\n/start bilan davom eting.');
      state.mode = 'idle';
      saveState();
    } else {
      bot.sendMessage(cid, `Keyingi: ${state.currentPart}-qism kutilyapti`);
    }
    return;
  }

  // Elon tashlash — barcha t.me linklari kanal linkiga almashtiriladi
  if (msg.photo && msg.caption && state.mode === 'waiting_announces') {
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    let caption = msg.caption.trim();

    // Kanalning to‘g‘ri havolasini hosil qilish
    let channelLink = state.channelId;
    if (state.channelId.startsWith('@')) {
      channelLink = `https://t.me/${state.channelId.slice(1)}`;
    } else if (state.channelId.startsWith('-100')) {
      channelLink = `https://t.me/c/${state.channelId.slice(4)}`;
    }

    // Caption ichidagi barcha https://t.me/... linklarini kanal linkiga almashtirish
    caption = caption.replace(
      /https?:\/\/t\.me\/[^\s]+/gi,
      channelLink
    );

    bot.sendPhoto(state.channelId, photoId, { caption })
      .then(() => bot.sendMessage(cid, 'Elon yuklandi ✅'))
      .catch(err => {
        console.error(err);
        bot.sendMessage(cid, 'Elonni yuborib bo‘lmadi. Bot adminligini tekshiring.');
      });

    bot.sendMessage(cid, 'Yana elon yuborishingiz mumkin yoki /start bilan menyuga qayting.');
    return;
  }

  // Noma'lum holatda
  if (state.mode !== 'idle') {
    bot.sendMessage(cid, 'Hozirgi rejim uchun to‘g‘ri ma’lumot kiriting.\nAgar chalkash bo‘lsa → /start');
  }
});

function startAddSeries(cid) {
  bot.sendMessage(cid, `Kanal: ${state.channelId}\n\nSeriya ID sini yuboring (masalan: JujutsuKaisen, UUID, anime123...):`);
  state.mode = 'waiting_id';
  saveState();
}

function startAnnounce(cid) {
  bot.sendMessage(cid, 'Elon uchun rasm + matn yuboring (caption bilan).\nBarcha t.me linklari avtomatik kanal linkiga o‘zgartiriladi.');
  state.mode = 'waiting_announces';
  saveState();
}

function resetState(cid) {
  state.mode = 'idle';
  state.currentId = '';
  state.startPart = 1;
  state.endPart = 0;
  state.currentPart = 0;
  saveState();
  bot.sendMessage(cid, 'Barcha jarayonlar bekor qilindi. /start bilan davom eting.');
}

console.log('Bot ishlamoqda...');