const { cmd, commands } = require('../command');
const config = require('../config');
const { runtime } = require('../lib/functions');

cmd({
    pattern: "alive",
    desc: "Check bot online or no.",
    category: "main",
    filename: __filename
},
async (hansaka, mek, m, {
    from, quoted, pushname, prefix
}) => {
    try {
        const uptime = runtime(process.uptime());
        let aliveText = `👋 *HI ${pushname}!*

I am **olya MD** - ALIVE NOW! 🧬🤖

⏰ *Uptime:* ${uptime}
⚙️ *Status:* Fully Operational
👑 *Developer:* Hansaka P. Fernando

🔢 *Reply with the number:*
1️⃣ **MAIN MENU** (.menu)
2️⃣ **CONTACT OWNER** (owner info)

© olya MD ALIVE SERVICE`;

        return await hansaka.sendMessage(from, {
            image: { url: config.ALIVE_IMG },
            caption: aliveText,
            contextInfo: {
                externalAdReply: {
                    title: "olya MD - STATUS: ONLINE",
                    body: "Powering Education with AI",
                    mediaType: 1,
                    thumbnailUrl: config.ALIVE_IMG,
                    sourceUrl: "https://wa.me/94779912589",
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
        m.reply(`${e}`);
    }
});
