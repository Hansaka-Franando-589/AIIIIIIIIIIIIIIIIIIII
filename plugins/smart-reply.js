const { cmd } = require('../command');

// 🧠 Smart Reply Database (ඔබට අවශ්‍ය පරිදි මෙහි දත්ත වෙනස් කළ හැක)
// Types: 'text' (සාමාන්‍ය පණිවිඩ), 'sticker' (WebP ස්ටිකර්), 'voice' (Audio/Voice Notes)
const replyDatabase = [
    {
        keywords: /^(hi|hello|හලෝ|හායි|hy|helo)$/i,
        reaction: '👋',
        type: 'sticker',
        // මෙතනට ඔයාගේ Waving ස්ටිකර් එකේ Cloud URL එක දෙන්න
        url: 'https://raw.githubusercontent.com/username/repo/main/media/hi-sticker.webp' 
    },
    {
        keywords: /(thank you|thanks|ස්තූතියි|thankz|tq|tnx)/i,
        reaction: '❤️',
        type: 'text',
        reply: 'ඔයාටත් ගොඩක් ස්තූතියි! මට පුළුවන් වෙලාවක ආයෙත් උදව් කරන්නම්. 😊'
    },
    {
        keywords: /(උදෑසනක්|morning|gm|good morning)/i,
        reaction: '🌅',
        type: 'text',
        reply: 'සුබ උදෑසනක්! අද දවස ඔයාට සාර්ථක වේවා කියලා ප්‍රාර්ථනා කරනවා. ✨'
    },
    {
        keywords: /(කවුද ඔයා|who are you|oyage nama|නම මොකක්ද|who is this)/i,
        reaction: '🤖',
        type: 'text',
        reply: '> 👋 *හලෝ! මම Olya Assistant.*\n> මම තමයි මේ පද්ධතියේ කෘත්‍රිම බුද්ධි සහායකයා. මාව නිර්මාණය කළේ Hansaka P. Fernando විසිනි. 🚀'
    },
    {
        keywords: /(පිස්සුද|pissuda|crazy|yako)/i,
        reaction: '😂',
        type: 'sticker',
        // හිනාවෙන ස්ටිකර් එකක URL එකක්
        url: 'https://raw.githubusercontent.com/username/repo/main/media/laugh.webp' 
    },
    {
        keywords: /(voice|කතා කරන්න|audio)/i,
        reaction: '🎙️',
        type: 'voice',
        // මෙතනට ඔයාගේ Voice Note එකේ (.mp3 හෝ .ogg) URL එක දෙන්න
        url: 'https://raw.githubusercontent.com/username/repo/main/media/hello-voice.mp3' 
    }
];

// මේක 'on: body' ලෙස යොදා ඇත්තේ සෑම පණිවිඩයකම වචන කියවීමටයි
cmd({
    on: "body",
    desc: "Smart auto-reply system for common keywords.",
    category: "ai",
    filename: __filename
},
async (hansaka, mek, m, { from, body, reply }) => {
    try {
        if (!body) return;
        const text = body.toLowerCase();

        // Database එක හරහා පරීක්ෂා කිරීම
        for (const entry of replyDatabase) {
            if (entry.keywords.test(text)) {
                
                // 1. අදාළ Reaction (Emoji) එක දැමීම
                if (entry.reaction) {
                    await hansaka.sendMessage(from, { react: { text: entry.reaction, key: mek.key } });
                }

                // 2. Text (සාමාන්‍ය පණිවිඩ) යැවීම
                if (entry.type === 'text' && entry.reply) {
                    return reply(entry.reply);
                }

                // 3. Sticker යැවීම
                if (entry.type === 'sticker' && entry.url) {
                    return await hansaka.sendMessage(from, { 
                        sticker: { url: entry.url } 
                    }, { quoted: mek });
                }

                // 4. Voice Note (PTT) යැවීම
                if (entry.type === 'voice' && entry.url) {
                    return await hansaka.sendMessage(from, { 
                        audio: { url: entry.url }, 
                        mimetype: 'audio/mp4', 
                        ptt: true // ptt: true යනු මෙය Voice Note එකක් ලෙස පෙන්වන බවයි (Forward කළ Audio එකක් ලෙස නොවේ)
                    }, { quoted: mek });
                }

                break; // එක Keyword එකකට මැච් වුණාට පස්සේ අනෙක් ඒවා පරීක්ෂා කිරීම නවත්වයි (Spam වීම වැළැක්වීමට)
            }
        }

    } catch (e) {
        console.error("Smart Reply Error:", e.message);
    }
});