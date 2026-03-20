const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');

cmd({
    pattern: "logo",
    desc: "Create a cool logo with your name.",
    category: "utility",
    filename: __filename
},
async (hansaka, mek, m, { from, q, reply }) => {
    if (!q) return reply("කරුණාකර ලෝගෝ එකට අවශ්‍ය නම ලබා දෙන්න. (උදා: .logo olya)");
    try {
        await hansaka.sendMessage(from, { react: { text: "🎨", key: mek.key } });
        // Using a free logo API
        const logoUrl = `https://api.vreden.my.id/api/textpro-generic?text=${encodeURIComponent(q)}&link=https://textpro.me/create-realistic-golden-text-effect-on-black-background-1089.html`;
        
        await hansaka.sendMessage(from, { 
            image: { url: logoUrl }, 
            caption: `✨ *Logo Created Successfully!* ✨\n\n👤 *Name:* ${q}\n👑 *Developer:* Hansaka P. Fernando` 
        }, { quoted: mek });
    } catch (e) {
        reply("ලෝගෝ එක සෑදීමේදී දෝෂයක් ඇතිවිය.");
    }
});

cmd({
    pattern: "broadcast",
    alias: ["bc"],
    desc: "Send message to all users.",
    category: "owner",
    filename: __filename
},
async (hansaka, mek, m, { from, q, isOwner, reply }) => {
    if (!isOwner) return reply("මෙය භාවිතා කළ හැක්කේ අයිතිකරුට පමණි.");
    if (!q) return reply("යැවිය යුතු පණිවිඩය ඇතුලත් කරන්න.");

    const USERS_FILE = './users.json';
    if (!fs.existsSync(USERS_FILE)) return reply("තවමත් පරිශීලකයින් ලියාපදිංචි වී නැත.");
    
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    reply(`පණිවිඩය යවමින් පවතී... (සමස්ත ගොනුව: ${users.length})`);

    let count = 0;
    for (let jid of users) {
        try {
            await hansaka.sendMessage(jid + "@s.whatsapp.net", { text: `📢 *olya MD - BROADCAST*\n\n${q}\n\n_System Admin: Hansaka P. Fernando_` });
            count++;
        } catch (e) {
            console.log(`Failed for ${jid}`);
        }
    }
    reply(`සාර්ථකව පණිවිඩ ${count} ක් යවන ලදී. ✅`);
});

cmd({
    pattern: "google",
    desc: "Search anything on Google.",
    category: "utility",
    filename: __filename
},
async (hansaka, mek, m, { from, q, reply }) => {
    if (!q) return reply("සෙවිය යුතු දේ පවසන්න.");
    try {
        const res = await axios.get(`https://api.vreden.my.id/api/google?query=${encodeURIComponent(q)}`);
        const result = res.data.result;
        let text = `🔍 *Google Search Results* for: ${q}\n\n`;
        result.forEach((v, i) => {
            if (i < 5) text += `*${i+1}. ${v.title}*\n🔗 ${v.link}\n\n`;
        });
        reply(text);
    } catch (e) {
        reply("සෙවීමේදී දෝෂයක් ඇතිවිය.");
    }
});

cmd({
    pattern: "owner",
    alias: ["contact", "dev"],
    desc: "Get owner's contact card.",
    category: "utility",
    filename: __filename
},
async (hansaka, mek, m, { from }) => {
    const vcard = 'BEGIN:VCARD\n'
                + 'VERSION:3.0\n' 
                + 'FN:Hansaka P. Fernando\n'
                + 'ORG:olya MD - Founder;\n'
                + 'TEL;type=CELL;type=VOICE;waid=94779912589:+94 77 991 2589\n'
                + 'END:VCARD';
    
    await hansaka.sendMessage(from, { 
        contacts: { 
            displayName: 'Hansaka P. Fernando', 
            contacts: [{ vcard }] 
        }
    }, { quoted: mek });
});
