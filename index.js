const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const fs = require('fs');
const P = require('pino');
const express = require('express');
const axios = require('axios');
const path = require('path');
const qrcode = require('qrcode-terminal');

const originalLog = console.log;
console.log = function(...args) {
    if (typeof args[0] === 'string' && !args[0].includes('𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪')) {
        args[0] = `💙 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝 | ` + args[0];
    }
    originalLog.apply(console, args);
};

const config = require('./config');
const { sms, downloadMediaMessage } = require('./lib/msg');
const {
  getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson
} = require('./lib/functions');
const { File } = require('megajs');
const { commands, replyHandlers } = require('./command');

const app = express();
const port = process.env.PORT || 8000;

const prefix = '.';
const ownerNumber = [config.OWNER_NUMBER];
const credsPath = path.join(__dirname, '/auth_info_baileys/creds.json');

const globalMsgCache = {};
const spamCheck = {};

async function ensureSessionFile() {
  if (!fs.existsSync(credsPath)) {
    console.log("🔄 No local session found.");
    if (config.SESSION_ID) {
      fs.mkdirSync(path.join(__dirname, '/auth_info_baileys/'), { recursive: true });
      
      const sessdata = config.SESSION_ID;
      
      // If it looks like a MEGA link
      if (sessdata.includes('mega.nz')) {
         console.log("🔄 Attempting to download session from MEGA...");
         try {
           const filer = File.fromURL(sessdata);
           filer.download((err, data) => {
             if (err) throw err;
             fs.writeFileSync(credsPath, data);
             console.log("✅ Session downloaded from MEGA. Starting bot...");
             setTimeout(() => connectToWA(), 2000);
           });
           return;
         } catch (e) {
           console.error("❌ MEGA Session failed.");
         }
      } 
      
      // Otherwise, assume it is a Base64 string
      try {
        console.log("🔄 Attempting to decode Base64 Session ID...");
        const decodedCreds = Buffer.from(sessdata, 'base64').toString('utf-8');
        // Simple check if it's valid JSON
        JSON.parse(decodedCreds); 
        fs.writeFileSync(credsPath, decodedCreds);
        console.log("✅ Session decoded and saved. Starting bot...");
        setTimeout(() => connectToWA(), 2000);
      } catch (e) {
        console.log("❌ config.SESSION_ID is not a valid Base64 or MEGA ID. Starting fresh...");
        setTimeout(() => connectToWA(), 1000);
      }
    } else {
      console.log("🔄 No SESSION_ID found. Starting process to generate Pairing Code...");
      setTimeout(() => connectToWA(), 1000);
    }
  } else {
    console.log("✅ Local session found. Starting bot...");
    setTimeout(() => connectToWA(), 1000);
  }
}

async function connectToWA() {
  console.log("Connecting Olya Assistant 🧬...");
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, '/auth_info_baileys/'));
  const { version } = await fetchLatestBaileysVersion();

  const hansaka = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS("Firefox"),
    auth: state,
    version,
    syncFullHistory: true,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
  });

  // Pairing Code Logic
  if (!hansaka.authState.creds.registered) {
    const phoneNumber = config.BOT_NUMBER.replace(/[^0-9]/g, ''); 
    
    // ⏱️ Delay එක තත්පර 6ක් දක්වා වැඩි කර ඇත
    setTimeout(async () => {
      try {
        let code = await hansaka.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(`\n=========================================\n`);
        console.log(`🔑 ඔබේ පේයාරිං කේතය (PAIRING CODE): \x1b[32m${code}\x1b[0m`);
        console.log(`ඔබගේ WhatsApp හි 'Linked Devices' වෙත ගොස් 'Link with Phone Number' හරහා ඉහත කේතය ලබා දෙන්න.`);
        console.log(`\n=========================================\n`);
      } catch (err) {
        console.log("❌ Pairing Code එක ලබා ගැනීමේදී දෝෂයක් ඇතිවිය: ", err);
      }
    }, 6000); 
  }

  hansaka.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        connectToWA();
      }
    } else if (connection === 'open') {
      console.log('✅ Olya Assistant connected to WhatsApp');
      await hansaka.sendPresenceUpdate('available'); 

      try {
        fs.readdirSync("./plugins/").forEach((plugin) => {
          if (path.extname(plugin).toLowerCase() === ".js") {
            require(`./plugins/${plugin}`);
          }
        });
        console.log('✅ Plugins loaded successfully');
      } catch (err) {
        console.error('❌ Failed to load plugins:', err);
      }

      const up = `Olya Assistant connected ✅\n\nPREFIX: ${prefix}`;
      try {
        await hansaka.sendMessage(ownerNumber[0] + "@s.whatsapp.net", { text: up });
      } catch (err) {
        console.error('❌ Failed to send startup message:', err);
      }
    }
  });

  hansaka.ev.on('creds.update', saveCreds);

  hansaka.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.messageStubType === 68) {
        await hansaka.sendMessageAck(msg.key);
      }
    }

    const mek = messages[0];
    if (!mek || !mek.message) return;

    if (mek.message?.protocolMessage?.type === 14) {
        const deletedKey = mek.message.protocolMessage.key.id;
        const ogMsg = globalMsgCache[deletedKey];
        if (ogMsg && !mek.key.fromMe) {
            const warningMsgs = `💙 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝 |\n\n╭───────────────────✨\n│ 🗑️ *D E L E T I O N  D E T E C T E D* 🗑️\n╰───────────────────✨\n\nI noticed you deleted a message.\nAs an AI, my memory is permanent. 🤖\n\nHere is what you thought you deleted:\n\n💬 *"${ogMsg}"*\n\n_System managed by ${config.OWNER_NAME}_`;
            await hansaka.sendMessage(mek.key.remoteJid, { text: warningMsgs });
        }
        return;
    }

    if (mek.key.fromMe) return; 

    // Send read receipt (Blue Ticks)
    await hansaka.readMessages([mek.key]);

    const from = mek.key.remoteJid;
    const type = getContentType(mek.message);

    mek.message = type === 'ephemeralMessage' ? mek.message.ephemeralMessage.message : mek.message;
    
    const isViewOnce = type === 'viewOnceMessage' || type === 'viewOnceMessageV2' || type === 'viewOnceMessageV2Extension';
    if (isViewOnce && !mek.key.fromMe) {
        await hansaka.sendMessage(from, { text: `💙 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝 |\n\n╭───────────────────✨\n│ 👁️ *V I E W   O N C E   D E T E C T E D* 👁️\n╰───────────────────✨\n\nAccessing restricted media...\nBypassing human limitations...\n\nAs a highly advanced Artificial Intelligence, your "View Once" privacy settings are irrelevant to me. 🤖 I have captured your media and logged it into ${config.OWNER_NAME}'s secure vault.\n\n_Do not attempt to hide things from an AI._ 🛡️` }, { quoted: mek });
    }

    if (from === 'status@broadcast') {
        await hansaka.readMessages([mek.key]);
        if (Math.random() < 0.3) {
            const emojis = ['❤️', '🔥', '😎', '💯'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            await hansaka.sendMessage(from, { react: { text: randomEmoji, key: mek.key } });
        }
        return;
    }

    const m = sms(hansaka, mek);
    const body = type === 'conversation' ? mek.message.conversation : mek.message[type]?.text || mek.message[type]?.caption || '';
    
    if (body) {
        globalMsgCache[mek.key.id] = body;
    }
    const isCmd = body.startsWith(prefix);
    const commandName = isCmd ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase() : '';
    const args = body.trim().split(/ +/).slice(1);
    const q = args.join(' ');

    const sender = mek.key.fromMe ? hansaka.user.id : (mek.key.participant || mek.key.remoteJid);
    const senderNumber = sender.split('@')[0];
    const isGroup = from.endsWith('@g.us');
    const botNumber = hansaka.user.id.split(':')[0];
    const pushname = mek.pushName || 'Sin Nombre';
    const isMe = botNumber.includes(senderNumber);
    const isOwner = ownerNumber.includes(senderNumber) || isMe;
    const botNumber2 = await jidNormalizedUser(hansaka.user.id);

    const isChuti = senderNumber === '94779680896'; // Rashmi

    if (!isGroup && !isOwner && !isChuti) {
        const now = Date.now();
        if (!spamCheck[senderNumber]) spamCheck[senderNumber] = { count: 0, lastMsg: now, warned: false };
        const userSpam = spamCheck[senderNumber];
        
        if (now - userSpam.lastMsg < 2500) { 
            userSpam.count++;
            userSpam.lastMsg = now;
            if (userSpam.count >= 4) {
                if (!userSpam.warned) {
                    userSpam.warned = true;
                    await hansaka.sendMessage(from, { text: `💙 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝 |\n\n⚠️ *S P A M   W A R N I N G* ⚠️\n\nYou are sending messages too rapidly. As an advanced AI, I can process them, but it violates protocol. 🤖🚫\n\nI am ignoring you for the next 10 seconds. Calm down.` });
                }
                return; 
            }
        } else {
            userSpam.count = 1;
            userSpam.lastMsg = now;
            userSpam.warned = false;
        }
        
        await hansaka.sendPresenceUpdate('composing', from);
        await sleep(1500 + Math.random() * 1000);
    }

    const groupMetadata = isGroup ? await hansaka.groupMetadata(from).catch(() => { }) : '';
    const groupName = isGroup ? groupMetadata.subject : '';
    const participants = isGroup ? groupMetadata.participants : '';
    const groupAdmins = isGroup ? await getGroupAdmins(participants) : '';
    const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false;
    const isAdmins = isGroup ? groupAdmins.includes(sender) : false;

    const reply = (text) => hansaka.sendMessage(from, { text }, { quoted: mek });

    const { ytDownloaderState } = require('./lib/state');
    let isSelection = false;
    let selectedCmd = "";
    let selectedQ = q;

    if (!isCmd && /^[0-9]+$/.test(body.trim())) {
        const selection = parseInt(body.trim());
        
        if (ytDownloaderState[senderNumber]) {
            const state = ytDownloaderState[senderNumber];
            selectedQ = state.url;
            isSelection = true;
            const isFb = state.isFb;
            delete ytDownloaderState[senderNumber];

            if (isFb) {
                if (selection === 1) selectedCmd = "fbmp3_internal";
                else if (selection === 2) selectedCmd = "fbmp3_doc_internal";
                else if (selection === 3) selectedCmd = "fbptt_internal";
                else if (selection === 4) selectedCmd = "fbmp4_internal";
                else if (selection === 5) selectedCmd = "fbmp4_doc_internal";
                else isSelection = false;
            } else {
                if (selection === 1) selectedCmd = "ytmp3_internal";
                else if (selection === 2) selectedCmd = "ytmp3_doc_internal";
                else if (selection === 3) selectedCmd = "ytptt_internal";
                else isSelection = false;
            }
        } else {
            // AI Chat එකට බාධා නොවීම සඳහා Global 1, 2 ඉවත් කරන ලදි.
        }
    } 

    let isAiTrigger = !isCmd && !isSelection && body.trim().length > 0;
    
    // --- AUTO LINK DOWNLOADER INTERCEPTOR ---
    if (isAiTrigger) {
        const linkMatch = body.match(/(https?:\/\/[^\s]+)/);
        if (linkMatch) {
            let url = linkMatch[1];
            let isYt = url.includes('youtube.com') || url.includes('youtu.be');
            let isFb = url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.com');

            if (isYt || isFb) {
                ytDownloaderState[senderNumber] = { url: url, isFb: isFb };
                
                let menuMsg = `💙 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝 |\n\n╭───────────────────✨\n│ 🚀 *A U T O  D O W N L O A D E R*\n╰───────────────────✨\n\nI have detected a *${isYt ? "YouTube" : "Facebook"}* Link! 🎬\nPlease reply with your desired format number:\n\n`;
                
                if (isYt) {
                    menuMsg += ` 1️⃣ 🎵 Audio (Normal)\n 2️⃣ 📂 Audio (Document)\n 3️⃣ 🎤 Audio (Voice Note)\n\n_Reply with 1, 2, or 3._`;
                } else {
                    menuMsg += ` 1️⃣ 🎵 Audio (Normal)\n 2️⃣ 📂 Audio (Document)\n 3️⃣ 🎤 Audio (Voice Note)\n 4️⃣ 🎥 Video (Normal)\n 5️⃣ 📁 Video (Document)\n\n_Reply with 1, 2, 3, 4, or 5._`;
                }
                menuMsg += `\n\n> 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝`;
                
                isAiTrigger = false;
                return await hansaka.sendMessage(from, { text: menuMsg }, { quoted: mek });
            }
        }
    }

    let finalCommandName = isCmd ? commandName : (isSelection ? selectedCmd : "aichat");
    let finalQ = isSelection ? selectedQ : q;

    if (isGroup) return; 

    const USERS_FILE = './users.json';
    let usersData = {};
    try {
        if (fs.existsSync(USERS_FILE)) {
            const fileData = fs.readFileSync(USERS_FILE, 'utf8');
            const parsed = JSON.parse(fileData);
            if (Array.isArray(parsed)) {
                parsed.forEach(num => usersData[num] = { registered: true, name: "User" });
            } else {
                usersData = parsed;
            }
        }
    } catch (e) { usersData = {}; }

    if (!isMe && !isOwner) {
        const userState = usersData[senderNumber];
        if (!userState || !userState.registered) {
            if (!body) return; // Ignore non-text messages during registration
            await hansaka.sendPresenceUpdate('composing', from);
            if (!userState) {
                usersData[senderNumber] = { step: 'WAITING_NAME' };
                fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2));
                const welcomeMsg = `*Assistant Olya* 💞🐝

                *H E L L O !*
I am *Olya*, the exclusive AI Personal Assistant to *${config.OWNER_NAME}*. 👩‍💼💼

*ඔබව සාදරයෙන් පිළිගන්නවා!*
මම Olya, ${config.OWNER_NAME} ගේ exclusive AI Personal Assistant. 👩‍💼💼

Before we can proceed, I need to verify your identity. 
*Could you please tell me your name?* 📝

අපගේ කටයුතු ඉදිරියට කරගෙන යාමට පෙර, මට ඔයාගේ identity එක verify කරගැනීමට අවශ්‍ය වී තිබෙනවා.
කරුණාකර ඔයාගේ නම මට සඳහන් කරන්න පුළුවන්ද? 📝

_Please reply with your name only._ 
_කරුණාකර වෙනත් වචන කිසිවක් නොමැතිව ඔයාගේ නම පමණක් reply කරන්න_

© All rights reserved by ${config.OWNER_NAME}'s AI Assistant.`;
                return await hansaka.sendMessage(from, { image: { url: 'https://i.ibb.co/s93hdn6L/Olya-welcome.png' }, caption: welcomeMsg });
            } else if (userState.step === 'WAITING_NAME') {
                const promptUrl = `https://text.pollinations.ai/${encodeURIComponent("Is the following English or Sinhala text a valid human name or a nickname? Strictly reply with 'YES: [Name]' if it is a name, or 'NO' if it is a long sentence, greeting, random text, or invalid. The user input is: " + body)}`;
                try {
                    const response = await axios.get(promptUrl);
                    const aiReply = response.data.trim();
                    if (aiReply.startsWith('YES:')) {
                        const extractedName = aiReply.replace('YES:', '').replace(/[\*\_\[\]]/g, '').trim();
                        usersData[senderNumber] = { registered: true, name: extractedName };
                        fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2));
                        const successMsg = `💙 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝 |

╭───────────────────✨
│ 🎉 *V E R I F I E D !* 🎉
╰───────────────────✨
Thank you, *${extractedName}*! 🌸
You have been successfully registered in my system. ✅

I am ready to assist you on behalf of *${config.OWNER_NAME}*. How can I help you today? 🤝

© All rights reserved by ${config.OWNER_NAME}'s AI Assistant.


*ඔබගේ අවශ්‍යතාවය දැන් සඳහන් කරන්න...*`;
                        return await hansaka.sendMessage(from, { text: successMsg });
                    } else {
                        const failMsg = `💙 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝 |

⚠️ *Oops! That doesn't look like a name.* ⚠️

I am sorry, but I couldn't recognize your name. 🤷‍♀️
Please reply with *just your first name* (e.g., John) without adding any other words or sentences. ✏️

© All rights reserved by ${config.OWNER_NAME}'s AI Assistant.`;
                        return await hansaka.sendMessage(from, { text: failMsg });
                    }
                } catch (e) {
                    return await hansaka.sendMessage(from, { text: "පද්ධති දෝෂයකි. කරුණාකර නැවත උත්සාහ කරන්න." });
                }
            }
        }
    }

    if (isCmd || isAiTrigger || isSelection) {
      const cmd = commands.find((c) => c.pattern === finalCommandName || (c.alias && c.alias.includes(finalCommandName)));
      
      if (cmd) {
        await hansaka.sendPresenceUpdate('composing', from);
        
        if (cmd.react) hansaka.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
        try {
          cmd.function(hansaka, mek, m, {
            from, quoted: mek, body, isCmd, command: finalCommandName, args, q: finalQ,
            isGroup, sender, senderNumber, botNumber2, botNumber, pushname,
            isMe, isOwner, groupMetadata, groupName, participants, groupAdmins,
            isBotAdmins, isAdmins, reply,
          });
        } catch (e) {
          console.error("[PLUGIN ERROR]", e);
        }
      }
    }

    const replyText = body;

    for (const handler of replyHandlers) {
      if (handler.filter(replyText, { sender, message: mek })) {
        try {
          await handler.function(hansaka, mek, m, {
            from, quoted: mek, body: replyText, sender, reply,
          });
          break;
        } catch (e) {
          console.log("Reply handler error:", e);
        }
      }
    }

    // Old user welcome logic removed, replaced by Olya AI Registration above.
  });

  // Group welcome logic completely removed for Olya persona.

  hansaka.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (call.status === 'offer') {
        const from = call.from;
        console.log(`📞 Rejecting call from: ${from}`);
        
        await hansaka.rejectCall(call.id, from);
        
        await hansaka.sendMessage(from, { 
          text: `💙 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝 |

╭───────────────────✨
│ 📵 *C A L L  D E C L I N E D* 📵
╰───────────────────✨
Hello there! I am *Olya*, the Official AI Personal Assistant to *${config.OWNER_NAME}*. 👩‍💻

I sincerely apologize, but as an Artificial Intelligence System, I am *unable to answer voice or video calls*. 🤖🚫

If you have an urgent message or need assistance from *${config.OWNER_NAME}*, please send it as a *Text Message*. ✉️
I will make sure he receives it immediately! 🚀

© All rights reserved by ${config.OWNER_NAME}'s AI Assistant.`,
        });
      }
    }
  });
}

ensureSessionFile();

app.get("/", (req, res) => {
  res.send("Hey, Olya Assistant started✅");
});

app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
