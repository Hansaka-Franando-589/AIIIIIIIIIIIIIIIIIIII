const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "img",
    alias: ["photo", "image"],
    desc: "Generate AI Image for free.",
    category: "ai",
    filename: __filename
},
async (hansaka, mek, m, { from, q, reply }) => {
    if (!q) return reply("කරුණාකර රූපය ගැන විස්තරයක් ලබා දෙන්න. (උදා: .img space ship)");

    try {
        await hansaka.sendMessage(from, { react: { text: "🎨", key: mek.key } });
        
        // Using Pollinations AI - Free and high quality
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(q)}?width=1024&height=1024&seed=${Math.floor(Math.random() * 10000)}`;

        await hansaka.sendMessage(from, { 
            image: { url: imageUrl }, 
            caption: `🎨 *AI Image Generated*
            
🔍 *Prompt:* ${q}
👑 *Developer:* Hansaka P. Fernando` 
        }, { quoted: mek });

    } catch (e) {
        console.error(e);
        reply("සමාවන්න, රූපය නිර්මාණය කිරීමට නොහැකි විය.");
    }
});

cmd({
    pattern: "search",
    desc: "Search for images on the web.",
    category: "search",
    filename: __filename
},
async (hansaka, mek, m, { from, q, reply }) => {
    if (!q) return reply("කරුණාකර සෙවිය යුතු දේ පවසන්න.");

    try {
        await hansaka.sendMessage(from, { react: { text: "🔍", key: mek.key } });
        
        // Simple Google Search Scraper via free API or proxy
        // Using a public free image search proxy/API
        const res = await axios.get(`https://api.vreden.my.id/api/gimage?query=${encodeURIComponent(q)}`);
        const results = res.data.result;
        
        if (!results || results.length === 0) return reply("කිසිදු ප්‍රතිඵලයක් හමු නොවීය.");

        await hansaka.sendMessage(from, { 
            image: { url: results[0] }, 
            caption: `🌐 *Image Search Results* for: ${q}` 
        }, { quoted: mek });

    } catch (e) {
        console.error(e);
        reply("සෙවීමේදී දෝෂයක් ඇතිවිය.");
    }
});
