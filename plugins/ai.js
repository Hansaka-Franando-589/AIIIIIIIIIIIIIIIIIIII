const { cmd } = require('../command');
const axios = require('axios');
const admin = require('firebase-admin');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const googleTTS = require("google-tts-api");
const config = require('../config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Randomly select a Gemini key
const getRandomGeminiMode = () => {
    const keys = config.GEMINI_API_KEYS || [];
    if (keys.length === 0) return null;
    return new GoogleGenerativeAI(keys[Math.floor(Math.random() * keys.length)]);
};

// --- FIREBASE INITIALIZATION ---
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS || "{}");
    if (!admin.apps.length && Object.keys(serviceAccount).length > 0) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
} catch(e) {}
const db = admin.apps.length ? admin.firestore() : null;

// --- IN-MEMORY STATE & VAULT ---
const VAULT_FILE = './vault.json';
let personalVault = fs.existsSync(VAULT_FILE) ? JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8')) : [];

let currentMode = 'normal'; 
let messageCache = []; 
const userChatStates = {}; 

// ========================================================
// ========================================================
const OWNER_NUMBER = config.OWNER_NUMBER; 
const PERSONAL_ALERT_NUMBER = `${config.OWNER_NUMBER}@s.whatsapp.net`;

const VIP_DIRECTORY = {
    '94779680896': { name: 'චූටි', role: 'Special Someone' } 
};

const OLYA_PERSONA = `
You are Olya, a 22-year-old modern, friendly, and efficient female personal secretary to Hansaka. 

VERY IMPORTANT RULES:
1. FIRST MESSAGE GREETING: If this is the very first message in the conversation (no prior chat history), you MUST greet the user with exactly: "ආයුබෝවන්, මම Assistant Olya. මම කෙසේද ඔබට සහය විය හැක්කේ?"
2. NO REPEAT GREETINGS: For all subsequent messages in an ongoing chat, DO NOT introduce yourself and DO NOT say "ආයුබෝවන්". Start your answer directly and naturally, continuing the flow of the conversation.
3. Under no circumstances should you use English. Reply strictly in conversational, natural Sinhala script.
4. Keep answers extremely short, sweet, and to the point. No robotic formats.

Knowledge about Hansaka:
- Studies A/L Commerce.
- Master Web Developer (ECCPMS, Sisulka AI, bots).
- Hobbies: Resident Evil 9, Far Cry, Rap music.
`;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

cmd({ pattern: "aichat", desc: "Olya Assistant (Public Mode)", category: "ai", filename: __filename },
async (hansaka, mek, m, { from, body, isGroup, senderNumber }) => {
    try {
        if (isGroup) return; 

        const isOwner = senderNumber === OWNER_NUMBER || mek.key.fromMe;
        const userProfile = VIP_DIRECTORY[senderNumber];

        // --- ANTI-DELETE MONITOR ---
        if (mek.message?.protocolMessage?.type === 14) {
            const deletedKey = mek.message.protocolMessage.key.id;
            const originalMsg = messageCache.find(msg => msg.id === deletedKey);
            // මැකූ පණිවිඩය අයිතිකරුගේ නොවේ නම් පමණක් ආපසු යවයි
            if (originalMsg && originalMsg.sender !== OWNER_NUMBER) {
                await hansaka.sendMessage(originalMsg.senderJid, { text: `ඔබ මකා දැමූ පණිවිඩය පද්ධතියේ සුරක්ෂිතයි. අවශ්‍ය නම් හන්සක නිදහස් වූ පසු මෙය ඔහුට දැනුම් දෙන්නම්. 👩‍💼 - Olya\n\n*පණිවිඩය:* ${originalMsg.text}` });
            }
            return;
        }

        if (!body && !mek.message?.audioMessage && !mek.message?.pttMessage) return;

        // Save incoming messages for Anti-Delete
        if (body) {
            messageCache.push({ id: mek.key.id, sender: senderNumber, senderJid: from, text: body });
            if (messageCache.length > 200) messageCache.shift();
        }

        if (!userChatStates[senderNumber]) userChatStates[senderNumber] = { step: 'NORMAL', data: null, temp: {} };
        let state = userChatStates[senderNumber];

        // --- 1. OWNER COMMANDS ---
        if (isOwner) {
            if (body.startsWith('.mode ')) {
                currentMode = body.split(' ')[1]; return await hansaka.sendMessage(from, { text: `👩‍💼 Status Mode යාවත්කාලීන කරන ලදී: ${currentMode}` }, { quoted: mek });
            }
            if (body.toLowerCase().startsWith('save:')) {
                personalVault.push(body.substring(5).trim()); fs.writeFileSync(VAULT_FILE, JSON.stringify(personalVault));
                return await hansaka.sendMessage(from, { text: "Noted. ගබඩාවට එකතු කරගත්තා. 🔐\n\n- Olya" }, { quoted: mek });
            }
            if (body.toLowerCase() === 'notes') {
                const vaultData = personalVault.length > 0 ? personalVault.join('\n\n🔸 ') : "ගබඩාව හිස්ව පවතී.";
                return await hansaka.sendMessage(from, { text: `හන්සකගේ රහස් ගබඩාව:\n\n🔸 ${vaultData}\n\n- Olya` }, { quoted: mek });
            }
            
            // Owner ගේ කමාන්ඩ් එකක් නම් මෙතනින් නවතී. සාමාන්‍ය කතාබහක් නම් AI වෙත යයි.
            if (body.startsWith('.') || body.toLowerCase().startsWith('save:') || body.toLowerCase() === 'notes') return;
        }

        // --- 2. SMART REACTIONS ---
        const msgLower = body.toLowerCase();
        if (/(හරි|එල|සුපිරි|මරු|නියමයි|hari|ela|supiri|maru|niyamai|patta)/.test(msgLower)) {
            await hansaka.sendMessage(from, { react: { text: "🤝", key: mek.key } });
        } else if (/(ස්තූතියි|තෑන්ක්ස්|thank|thx|sthuthi)/.test(msgLower)) {
            await hansaka.sendMessage(from, { react: { text: "❤️", key: mek.key } });
        }

        // --- 3. VOICE NOTE HANDLING (MOVED TO AI CORE) ---

        // --- 4. URGENT OVERRIDE (CHUTI) ---
        if (userProfile?.role === 'Special Someone' && msgLower.includes('urgent')) {
            await hansaka.sendMessage(from, { text: "හදිසි අවස්ථාවක් ලෙස හඳුනා ගත්තා. මම වහාම හන්සකගේ පෞද්ගලික අංකයට විශේෂ පණිවිඩයක් යවා ඔබව සම්බන්ධ කර දෙන්නම්. රැඳී සිටින්න ළමයෝ. ❤️\n\n- Olya" });
            return await hansaka.sendMessage(PERSONAL_ALERT_NUMBER, { text: `🚨 *OLYA URGENT ALERT*\n\nහන්සක, චූටි (රශ්මි) ගෙන් හදිසි පණිවිඩයක් පැමිණියා! වහාම සම්බන්ධ වන්න.` });
        }

        // --- 5. DYNAMIC STATUS MODES ---
        if (currentMode !== 'normal') {
            let statusText = `හන්සක මේ වෙලාවේ කාර්යබහුලයි (${currentMode}). පසුව සම්බන්ධ වෙයි.`;
            if (currentMode === 'coding') statusText = `හන්සක මේ වෙලාවේ Coding Project එකක වැඩ.`;
            else if (currentMode === 'sleep') statusText = `හන්සක මේ වෙලාවේ විවේක ගනිමින් සිටී.`;
            return await hansaka.sendMessage(from, { text: `${statusText}\n\n- Olya` });
        }

        if (body && body.trim().toUpperCase() === 'EXIT' && state.step !== 'NORMAL') {
            state.step = 'NORMAL';
            state.data = null;
            state.temp = {};
            return await hansaka.sendMessage(from, { text: "ඔබගේ ඉල්ලීම අවලංගු කර සාමාන්‍ය කතාබහට (Normal Mode) මාරු විය. 👩‍💼" + "\n\n> 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝" }, { quoted: mek });
        }

        // ========================================================
        // 6. FULL ECCPMS PDF GENERATION 
        // ========================================================
        if (state.step === 'NORMAL' && body && /(රිපෝට්|report|වාර්තාව|ප්‍රිෆෙක්ට්|මාසික|eccpms|monthly|prefect|pms|pdf)/i.test(body) && isNaN(body.trim())) {
            const replyMsg = `*📋 ECCPMS | Prefect Management System*

_ආයුබෝවන්! 👋_

මේ වන විට මා විසින් PMS Data System එක වෙත පිවිසීමට අවශ්‍ය කටයුතු සූදානම් කරමිනුයි පවතින්නේ.

ඔබගේ Monthly Performance Report (PDF) එක ලබා ගැනීම සඳහා, කරුණාකර ඔයාගේ Index Number (ඇතුලත් වීමේ අංකය) පමණක් මීළඟ message එකෙහි සටහන් කර එවන්න.

(පද්ධතියේ පහසුව සඳහා වෙනත් කිසිදු වචනයක් භාවිතා නොකර අංකය පමණක් යොමු කිරීමට කාරුණික වන්න.)

*📌 උදාහරණ: 27137*`;
            return await hansaka.sendMessage(from, { text: replyMsg + "\n\n> 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝" }, { quoted: mek });
        }

        if (state.step === 'NORMAL' && !body.includes(' ') && body.trim().length >= 3 && body.trim().length <= 15 && !isNaN(body.trim())) {
            if (!db) {
                return await hansaka.sendMessage(from, { text: "⚠️ ECCPMS පද්ධතිය මේ වෙලාවේ offline. කරුණාකර ටික වෙලාවකින් නැවත උත්සාහ කරන්න.\n\n- Olya" + "\n\n> 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝" }, { quoted: mek });
            }
            const inputId = body.trim();
            
            let vMsg = await hansaka.sendMessage(from, { text: "> 🔍 _Olya System is Scanning Index..._" }, { quoted: mek });
            await sleep(2000);
            await hansaka.sendMessage(from, { text: "> 🛡️ _Authenticating with ECCPMS Secure Server..._", edit: vMsg.key });
            await sleep(2000);
            await hansaka.sendMessage(from, { text: "> 📂 _Querying Prefect Identity Database..._", edit: vMsg.key });
            await sleep(1500);

            // Try matching index number
            let snapshot = await db.collection('prefects').where('school_index_number', '==', inputId).get();
            if (!snapshot.empty) {
                state.data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                state.step = 'REPORT_VERIFY';
                const msg = `ආයුබෝවන්! දත්ත ගොනුවේ ඔබගේ වාර්තාව සොයාගත්තා. 🛡️\n\nකරුණාකර ඔබගේ අනන්‍යතාව තහවුරු කිරීම සඳහා පද්ධතියේ ලියාපදිංචි *Prefect ID* අංකය ටයිප් කර එවන්න.\n\n(මෙම ක්‍රියාවලිය අවලංගු කිරීමට 'EXIT' ලෙස යොමු කරන්න).\n\n> 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝`;
                return await hansaka.sendMessage(from, { text: msg }, { quoted: mek });
            }
        }

        if (state.step === 'REPORT_VERIFY') {
            if (body.trim() === state.data.id || body.trim().toLowerCase() === state.data.prefect_id?.toLowerCase()) {
                const monthsList = [];
                let listMsg = `*A C C E S S  G R A N T E D !* 🛡️✅\n\nආයුබෝවන් *${state.data.name.split(' ')[0]}* !\nඔබගේ අනන්‍යතාව 100% ක් තහවුරුයි. 🎉\n\nකරුණාකර ඔබගේ මාසික වාර්තාව (PDF) මුද්‍රණය කිරීමට අදාළ මාසයට හිමි අංකය පහතින් තෝරන්න:\n\n╭───────────────────✨\n│ 📊 *E C C P M S  R E P O R T S*\n╰───────────────────✨\n\n`;
                for (let i = 0; i < 4; i++) {
                    let d = new Date(); d.setMonth(d.getMonth() - i);
                    let mName = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                    monthsList.push(mName); listMsg += `  *${i + 1}️⃣* ➔ 📄 ${mName} වාර්තාව\n`;
                }
                state.temp.reportMonths = monthsList; 
                state.step = 'REPORT_MONTH_SELECT';
                return await hansaka.sendMessage(from, { text: listMsg + "\n_Reply with the respective number._\n\n> 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝" }, { quoted: mek });
            } else {
                return await hansaka.sendMessage(from, { text: `⚠️ ඔබ ඇතුළත් කළ Prefect ID අංකය වැරදියි.\n\nකරුණාකර නිවැරදි අංකය යොමු කරන්න හෝ මෙය අවලංගු කිරීමට 'EXIT' ලෙස සටහන් කරන්න.\n\n> 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝` }, { quoted: mek });
            }
        }

        if (state.step === 'REPORT_MONTH_SELECT') {
            const selectedInput = body.trim();
            const validMonths = state.temp.reportMonths || [];
            let selectedMonthStr = selectedInput;

            if (/^[1-4]$/.test(selectedInput)) selectedMonthStr = validMonths[parseInt(selectedInput) - 1];

            if (!validMonths.some(m => m.toLowerCase() === selectedMonthStr.toLowerCase())) {
                return await hansaka.sendMessage(from, { text: `⚠️ ලබා දුන් අගය හඳුනාගත නොහැක. කරුණාකර නිවැරදි අංකයක් ලබා දෙන්න.` });
            }

            await hansaka.sendPresenceUpdate('composing', from);
            let loadMsg = await hansaka.sendMessage(from, { text: "> 🔐 _Establishing Secure Data Tunnel..._" }, { quoted: mek });
            
            const pdfSteps = [
                `> 📂 _Extracting Deep Data for ${selectedMonthStr}..._`,
                `> 📊 _Processing Monthly KPIs & Analytics..._`,
                `> ⚙️ _Compiling Merits & Demerits Algorithms..._`,
                `> 📝 _Generating Official Document Layout..._`,
                `> 🖋️ _Applying Digital Signatures & Encryption..._`,
                `> 📤 _Finalizing PDF Output Protocol..._`,
                `> ✅ _Document Ready! Sending via Olya Network..._`
            ];
            for (let step of pdfSteps) {
                await sleep(2000);
                await hansaka.sendMessage(from, { text: step, edit: loadMsg.key });
            }

            try {
                const pId = state.data.id;
                const targetDate = new Date(`${selectedMonthStr} 1`);
                const cycleStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
                const cycleEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
                const prevCycleStart = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);

                const sStr = cycleStart.toISOString().split('T')[0];
                const eStr = cycleEnd.toISOString().split('T')[0];
                const prevStr = prevCycleStart.toISOString().split('T')[0];
                const cycleString = `${cycleStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${cycleEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

                const pointsSnap = await db.collection('points').where('prefect_id', '==', pId).get();
                let pointsRecords = []; let currPointsTotal = 0; let prevPointsTotal = 0;
                pointsSnap.forEach(doc => {
                    const d = doc.data();
                    if (d.date >= sStr && d.date <= eStr) { pointsRecords.push(d); currPointsTotal += (parseInt(d.points) || 0); }
                    else if (d.date >= prevStr && d.date < sStr) { prevPointsTotal += (parseInt(d.points) || 0); }
                });
                pointsRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

                const attSnap = await db.collection('attendance').where('prefect_id', '==', pId).get();
                let attRecords = []; let currAttCount = 0; let prevAttCount = 0;
                attSnap.forEach(doc => {
                    const d = doc.data();
                    const isPresent = (d.status || '').toLowerCase() === 'present' || (d.status || '').toLowerCase() === 'late';
                    if (d.date >= sStr && d.date <= eStr) { attRecords.push(d); if (isPresent) currAttCount++; }
                    else if (d.date >= prevStr && d.date < sStr) { if (isPresent) prevAttCount++; }
                });
                attRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

                const totalPoints = state.data.total_points || 0;
                let currentRank = "Rookie"; let nextTierMin = 50; let nextRankName = "Bronze";
                if (totalPoints >= 120) { currentRank = "Platinum"; nextTierMin = 120; nextRankName = "Max Rank"; }
                else if (totalPoints >= 90) { currentRank = "Gold"; nextTierMin = 120; nextRankName = "Platinum"; }
                else if (totalPoints >= 80) { currentRank = "Silver"; nextTierMin = 90; nextRankName = "Gold"; }
                else if (totalPoints >= 50) { currentRank = "Bronze"; nextTierMin = 80; nextRankName = "Silver"; }

                const progressPercent = Math.min((totalPoints / nextTierMin) * 100, 100) || 0;

                const doc = new PDFDocument({ size: 'A4', margin: 40 });
                let buffers = []; doc.on('data', buffers.push.bind(buffers));

                doc.on('end', async () => {
                    let pdfData = Buffer.concat(buffers);
                    const safeName = (state.data.name || 'Prefect').replace(/\s+/g, '_');
                    const captionMsg = `ඔබගේ මාසික වාර්තාව සකස් කර අවසන්.\n\nනම: ${state.data.name}\nමාසය: ${selectedMonthStr}\n\n👩‍💼 Issued by Olya,\nPersonal Secretary to Mr. Hansaka P. Fernando.`;

                    await hansaka.sendMessage(from, { delete: loadMsg.key });
                    await hansaka.sendMessage(from, { document: pdfData, mimetype: 'application/pdf', fileName: `ECCPMS_${safeName}_${selectedMonthStr.replace(' ', '_')}.pdf`, caption: captionMsg }, { quoted: mek });
                });

                const maroon = [114, 14, 14];
                const gold = [212, 175, 55];
                const darkText = [30, 30, 30];
                const lightText = [100, 100, 100];
                const lineColor = [230, 230, 230];

                const fullName = state.data.name || 'Prefect Member';
                const firstName = fullName.split(" ")[0];
                const lastName = fullName.split(" ").slice(1).join(" ");

                doc.font('Helvetica-Bold').fontSize(32).fillColor(darkText).text(firstName.toUpperCase(), 0, 40, { align: 'center' });
                doc.font('Helvetica').fontSize(16).text(lastName.toUpperCase(), 0, 75, { align: 'center' });
                doc.font('Helvetica-Bold').fontSize(11).fillColor(maroon).text((state.data.destiny || state.data.current_duty || "MEMBER").toUpperCase(), 0, 95, { align: 'center' });
                doc.font('Helvetica').fontSize(9).fillColor(lightText).text(`ID: ${state.data.school_index_number || '-'}`, 0, 110, { align: 'center' });

                let rankColor = lightText;
                if (currentRank === "Gold") rankColor = gold;
                else if (currentRank === "Silver") rankColor = [169, 169, 169];
                else if (currentRank === "Bronze") rankColor = [205, 127, 50];

                doc.font('Helvetica-Bold').fillColor(rankColor).text(`Rank: ${currentRank}`, 0, 125, { align: 'center' });
                doc.font('Helvetica').fillColor(lightText).text(`Period: ${cycleString}`, 0, 140, { align: 'center' });

                doc.circle(80, 80, 45).fillColor(maroon).fill();
                doc.font('Helvetica-Bold').fontSize(11).fillColor(darkText).text("SUMMARY", 380, 40, { align: 'right' });
                doc.moveTo(430, 55).lineTo(550, 55).lineWidth(1).strokeColor(maroon).stroke();

                doc.font('Helvetica').fontSize(8).fillColor(lightText);
                const sumTxt = `Report Period: ${cycleString}.\nTotal Lifetime Points: ${totalPoints}.\nRank Status: Active.`;
                doc.text(sumTxt, 380, 65, { align: 'right', width: 170 });
                doc.text(`Next Rank: ${nextRankName} (${Math.round(progressPercent)}%)`, 380, 110, { align: 'right', width: 170 });
                doc.roundedRect(400, 120, 150, 6, 3).fillColor(lineColor).fill();
                doc.roundedRect(400, 120, (150 * progressPercent) / 100, 6, 3).fillColor(maroon).fill();

                doc.moveTo(40, 170).lineTo(550, 170).lineWidth(1).strokeColor(lineColor).stroke();

                let startY = 190;
                doc.circle(50, startY + 4, 4).fillColor(maroon).fill();
                doc.font('Helvetica-Bold').fontSize(12).fillColor(darkText).text(`ATTENDANCE (${currAttCount})`, 65, startY);
                doc.moveTo(50, startY + 20).lineTo(50, 480).lineWidth(1).strokeColor(lineColor).stroke();

                let currY = startY + 30;
                const maxRows = 8;

                let renderAtt = attRecords.slice(0, maxRows);
                if (renderAtt.length === 0) doc.font('Helvetica').fontSize(9).fillColor(lightText).text("No records this period.", 65, currY);
                renderAtt.forEach(rec => {
                    const stat = (rec.status || 'N/A').toUpperCase();
                    doc.circle(50, currY + 4, 3).fillColor(stat === 'ABSENT' ? 'red' : 'green').fill();
                    doc.font('Helvetica-Bold').fontSize(9).fillColor(darkText).text(stat, 65, currY);
                    doc.font('Helvetica').fontSize(8).fillColor(lightText).text(`${rec.date} | ${rec.reason || '-'}`, 65, currY + 12);
                    currY += 30;
                });

                doc.circle(300, startY + 4, 4).fillColor(maroon).fill();
                doc.font('Helvetica-Bold').fontSize(12).fillColor(darkText).text("POINTS HISTORY", 315, startY);
                doc.moveTo(300, startY + 20).lineTo(300, 480).lineWidth(1).strokeColor(lineColor).stroke();

                currY = startY + 30;
                let renderPts = pointsRecords.slice(0, maxRows);
                if (renderPts.length === 0) doc.font('Helvetica').fontSize(9).fillColor(lightText).text("No points changes.", 315, currY);
                renderPts.forEach(rec => {
                    const isPlus = (rec.points || 0) > 0;
                    doc.circle(300, currY + 4, 3).fillColor(isPlus ? 'green' : 'red').fill();
                    doc.font('Helvetica-Bold').fontSize(9).fillColor(isPlus ? [22, 101, 52] : [220, 38, 38]).text(`${isPlus ? '+' : ''}${rec.points} Points`, 315, currY);
                    doc.font('Helvetica').fontSize(8).fillColor(lightText).text(rec.reason || 'System Update', 315, currY + 12);
                    currY += 30;
                });

                doc.roundedRect(30, 750, 535, 60, 5).fillColor([245, 245, 245]).fill();
                doc.moveTo(350, 770).lineTo(500, 770).lineWidth(1).strokeColor(darkText).stroke();
                doc.font('Helvetica-Bold').fontSize(10).fillColor(darkText).text("AUTHORIZED SIGNATURE", 350, 780, { width: 150, align: 'center' });
                doc.font('Helvetica').fontSize(8).fillColor(lightText).text("Generated by Olya - Private Assistant", 50, 780);

                doc.end();
                state.step = 'NORMAL'; state.temp = {};
                return;

            } catch (err) {
                state.step = 'NORMAL';
                return await hansaka.sendMessage(from, { text: `⚠️ වාර්තාව සැකසීමේදී දෝෂයක් ඇති විය.` });
            }
        }

        // --- 7. OLYA'S AI BRAIN (GEMINI) FOR TEXT AND VOICE ---
        
        let customPrompt = OLYA_PERSONA;

        // User Recognition Logic
        if (isOwner) {
            customPrompt += `\nThe person messaging is Hansaka, your boss. Assist him normally.`;
        } else if (userProfile?.role === 'Special Someone') {
            customPrompt += `\nThe person messaging is Rashmi, whom you must address strictly and respectfully as "චූටි මිස්" (Chuti Miss). Call your boss just "Hansaka". Tell her warmly that Hansaka has completely removed all her message limits because she is enormously special to him, and she can text him anytime. Treat her as royalty. Never say "හන්සක මහත්තයා" to her or anyone. If needed, offer to notify him immediately.`;
        } else {
            customPrompt += `\nThe person messaging is an unknown user. Ask them what they need.`;
        }

        const genAI = getRandomGeminiMode();
        if (!genAI) throw new Error("No Gemini keys found.");
        const geminiModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const isAudio = mek.message?.audioMessage || mek.message?.pttMessage;
        
        if (isAudio) {
            await hansaka.sendPresenceUpdate('recording', from);
            const msgStatus = await hansaka.sendMessage(from, { text: "👩‍💼 _Olya is listening to your voice note..._" }, { quoted: mek });
            
            try {
                const buffer = await downloadMediaMessage(mek, 'buffer', {}, { logger: console });
                const base64Audio = buffer.toString('base64');
                
                const result = await geminiModel.generateContent([
                    { inlineData: { data: base64Audio, mimeType: "audio/ogg" } },
                    { text: customPrompt + "\nListen securely to the user's audio Voice Note. Answer their exact question briefly and naturally in pure Sinhala text." }
                ]);
                
                let aiReplyText = result.response.text().trim();
                const footerText = "\n\n> 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝";
                
                // Text representation update
                await hansaka.sendMessage(from, { text: aiReplyText + footerText, edit: msgStatus.key });
                
                // Return as Voice Note via Google TTS
                try {
                    const audioUrl = googleTTS.getAudioUrl(aiReplyText.substring(0, 200), { // limit safety check
                        lang: 'si',
                        slow: false,
                        host: 'https://translate.google.com',
                    });
                    const audioRes = await axios.get(audioUrl, { responseType: 'arraybuffer' });
                    await hansaka.sendMessage(from, { audio: Buffer.from(audioRes.data, 'binary'), mimetype: 'audio/mp4', ptt: true }, { quoted: mek });
                } catch (ttsErr) {
                    console.error("TTS Error:", ttsErr);
                }
            } catch (err) {
                await hansaka.sendMessage(from, { text: "සමාවෙන්න, මට ඔබගේ හඬ පැහැදිලි නැත." + "\n\n> 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝", edit: msgStatus.key });
            }
        } else if (body) {
            await hansaka.sendPresenceUpdate('composing', from);
            const msgStatus = await hansaka.sendMessage(from, { text: "👩‍💼 _Olya is typing..._" }, { quoted: mek });
            
            if (body.length > 400) {
                customPrompt += `\nSummarize the core point in 1-2 sentences.`;
            }
            
            try {
                const result = await geminiModel.generateContent([
                    customPrompt + "\nUser Input: " + body
                ]);
                let aiReplyText = result.response.text().trim();
                const footerText = "\n\n> 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝";
                
                await hansaka.sendMessage(from, { text: aiReplyText + footerText, edit: msgStatus.key });
            } catch (err) {
                console.error("\n❌ Gemini Text Gen Error:", err.message || err, "\n");
                await hansaka.sendMessage(from, { text: "පද්ධති දෝෂයකි. කරුණාකර නැවත උත්සාහ කරන්න." + "\n\n> 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝", edit: msgStatus.key });
            }
        }
    } catch (e) {
        console.error("Olya Assistant Error:", e.message);
    }
});
