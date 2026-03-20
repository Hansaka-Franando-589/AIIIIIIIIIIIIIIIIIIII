const fs = require('fs');
const path = require('path');

const credsPath = path.join(__dirname, 'auth_info_baileys', 'creds.json');

if (fs.existsSync(credsPath)) {
    const creds = fs.readFileSync(credsPath);
    const sessionString = Buffer.from(creds).toString('base64');
    console.log("\n=========================================");
    console.log("🚀 YOUR SESSION ID (Copy this):");
    console.log("=========================================\n");
    console.log(sessionString);
    console.log("\n=========================================");
    console.log("ඉහත මුළු කේතයම (Code) කොපි කරගෙන ඔබගේ config.js හි SESSION_ID එකට ලබා දෙන්න.");
} else {
    console.log("❌ creds.json ෆයිල් එක හමු නොවීය. කරුණාකර මුලින්ම බොට් ලින්ක් කරන්න.");
}
