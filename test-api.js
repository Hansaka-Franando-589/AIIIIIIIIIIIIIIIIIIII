const https = require('https');

const API_KEY = require('./config').GEMINI_API_KEY;
const data = JSON.stringify({ contents: [{ parts: [{ text: 'Hello, say hi back' }] }] });

const models = [
    { ver: 'v1beta', model: 'gemini-1.5-flash' },
    { ver: 'v1beta', model: 'gemini-1.5-flash-latest' },
    { ver: 'v1beta', model: 'gemini-2.0-flash' },
    { ver: 'v1beta', model: 'gemini-2.0-flash-lite' },
    { ver: 'v1', model: 'gemini-1.5-flash' },
    { ver: 'v1', model: 'gemini-1.5-pro' },
];

console.log('🔍 Testing API Key:', API_KEY ? API_KEY.substring(0, 15) + '...' : 'MISSING!');
console.log('='.repeat(60));

if (!API_KEY) {
    console.log('❌ No API key found in config.js!');
    process.exit(1);
}

models.forEach(({ ver, model }) => {
    const path = `/${ver}/models/${model}:generateContent?key=${API_KEY}`;
    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    const req = https.request(options, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const j = JSON.parse(body);
                    const reply = j.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 60) || 'No text';
                    console.log(`✅ WORKS: ${ver}/models/${model}`);
                    console.log(`   Reply: "${reply}"`);
                } catch {
                    console.log(`✅ HTTP 200 but parse failed: ${ver}/models/${model}`);
                }
            } else {
                try {
                    const j = JSON.parse(body);
                    console.log(`❌ ${res.statusCode}: ${ver}/models/${model} — ${j.error?.message?.substring(0, 80) || 'Unknown error'}`);
                } catch {
                    console.log(`❌ ${res.statusCode}: ${ver}/models/${model}`);
                }
            }
        });
    });

    req.on('error', e => console.log(`🔴 Network Error (${model}):`, e.message));
    req.write(data);
    req.end();
});
