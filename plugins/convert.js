const { cmd } = require('../command');
const { downloadMediaMessage } = require('../lib/msg');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const tmp = require('tmp');

cmd({
    pattern: "sticker",
    alias: ["st", "stiker"],
    desc: "Convert image/video to sticker.",
    category: "convert",
    filename: __filename
},
async (hansaka, mek, m, { from, reply, quoted, body }) => {
    try {
        const isImage = m.type === 'imageMessage' || (m.quoted && m.quoted.type === 'imageMessage');
        const isVideo = m.type === 'videoMessage' || (m.quoted && m.quoted.type === 'videoMessage');

        if (!isImage && !isVideo) return reply("කරුණාකර පින්තූරයක් හෝ වීඩියෝවක් එවන්න, නැතහොත් එයට රිප්ලයි කර .sticker ලෙස ටයිප් කරන්න.");

        await hansaka.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const mediaMsg = m.quoted ? m.quoted : m;
        const tempFile = tmp.fileSync({ postfix: isImage ? '.jpg' : '.mp4' });
        const mediaBuffer = await downloadMediaMessage(mediaMsg);
        fs.writeFileSync(tempFile.name, mediaBuffer);

        const outWebp = tmp.fileSync({ postfix: '.webp' });

        // Build FFmpeg command for sticker conversion
        // -vf "scale=512:512:force_original_aspect_ratio=increase,fps=15,crop=512:512" (to make it square)
        let command = '';
        if (isImage) {
            command = `ffmpeg -i ${tempFile.name} -vcodec libwebp -filter:v "scale='if(gt(a,1),512,-1)':'if(gt(a,1),-1,512)',pad=512:512:(512-iw)/2:(512-ih)/2:color=black@0" -lossless 1 ${outWebp.name}`;
        } else {
            command = `ffmpeg -i ${tempFile.name} -vcodec libwebp -filter:v "scale='if(gt(a,1),512,-1)':'if(gt(a,1),-1,512)',pad=512:512:(512-iw)/2:(512-ih)/2:color=black@0,fps=15,loop=0" -lossless 1 -preset default -an -vsync 0 -s 512:512 ${outWebp.name}`;
        }

        exec(command, async (err) => {
            if (err) {
                console.error(err);
                return reply("ස්ටිකර් එක සෑදීමේදී දෝෂයක් ඇතිවිය.");
            }

            let stickerBuffer = fs.readFileSync(outWebp.name);
            
            try {
                const webp = require('node-webpmux');
                const img = new webp.Image();
                await img.load(stickerBuffer);
                const exif = {
                    "sticker-pack-id": `olya-${Date.now()}`,
                    "sticker-pack-name": "olya MD 🧬",
                    "sticker-pack-publisher": "Hansaka P. Fernando",
                    "android-app-store-link": "https://wa.me/94779912589",
                    "ios-app-store-link": "https://wa.me/94779912589"
                };
                const exifBuffer = Buffer.concat([
                    Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]),
                    Buffer.from(JSON.stringify(exif), 'utf-8')
                ]);
                exifBuffer.writeUIntLE(JSON.stringify(exif).length, 14, 4);
                img.exif = exifBuffer;
                stickerBuffer = await img.save(null);
            } catch (exifErr) {
                console.error("Exif Error:", exifErr);
                // Continue with original buffer if metadata fail
            }

            await hansaka.sendMessage(from, { sticker: stickerBuffer }, { quoted: mek });

            // Clean up
            tempFile.removeCallback();
            outWebp.removeCallback();
        });

    } catch (e) {
        console.error(e);
        reply("සමාවන්න, යම් දෝෂයක් සිදු විය.");
    }
});
