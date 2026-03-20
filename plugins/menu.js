const { cmd, commands } = require("../command");
const config = require("../config");
const { runtime } = require("../lib/functions");

cmd(
  {
    pattern: "menu",
    desc: "Displays all available commands",
    category: "main",
    filename: __filename,
  },
  async (hansaka, mek, m, { from, pushname, prefix }) => {
    try {
      const categories = {};
      
      // Categorize commands
      for (let cmdData of commands) {
        if (cmdData.dontAddCommandList) continue;
        const cat = cmdData.category?.toLowerCase() || "other";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push({
          pattern: cmdData.pattern,
          desc: cmdData.desc || "No description"
        });
      }

      const ram = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      const uptime = runtime(process.uptime());

      // Beautiful Body Text matching the reference image layout
      let menuBody = `👋 *HI ${pushname}*

「 *BOT'S MENU* 」
👽 *Bot* : olya-MD
👤 *User* : ${pushname}
📟 *Owners* : Hansaka P. Fernando (94779912589)
⏰ *Uptime* : ${uptime}
📂 *Ram* : ${ram}MB
🖋 *Prefix* : ${prefix}

🎀 Ξ *Select a Command List:* Ξ
© *olya MD v1.0.0*
_Mini WaBot by Hansaka P Fernando_ ッ` ;

      // Create command list by category for the message body
      let listText = "";
      for (const [cat, cmds] of Object.entries(categories)) {
        listText += `\n📂 *${cat.toUpperCase()} CATEGORY*\n`;
        cmds.forEach(c => {
          listText += `  └ .${c.pattern}\n`;
        });
      }

      await hansaka.sendMessage(from, {
        image: { url: config.ALIVE_IMG },
        caption: menuBody + "\n" + listText,
        contextInfo: {
          mentionedJid: [m.sender],
          forwardingScore: 999,
          isForwarded: true,
          externalAdReply: {
            title: "olya MD - PREMIUM MENU",
            body: "Create By Hansaka P. Fernando",
            mediaType: 1,
            thumbnailUrl: config.ALIVE_IMG,
            sourceUrl: "https://wa.me/94779912589",
            renderLargerThumbnail: true
          }
        }
      }, { quoted: mek });

    } catch (err) {
      console.error(err);
      m.reply("❌ Error generating menu.");
    }
  }
);
