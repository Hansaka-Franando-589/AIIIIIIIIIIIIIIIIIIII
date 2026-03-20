<p align="center">
  <img src="https://i.ibb.co/s93hdn6L/Olya-welcome.png" width="400" alt="Olya Assistant">
</p>

# 💙 𝓐𝓼𝓼𝓲𝓼𝓽𝓪𝓷𝓽 𝓞𝓵𝔂𝓪 💞🐝
**Advanced WhatsApp AI Assistant | Powered by Gemini | Crafted by Hansaka P. Fernando**

Olya is a highly intelligent, secure, and fully customized WhatsApp bot designed to streamline personal workflows, assist with conversational AI tasks natively in Sinhala, and automate various platform downloads gracefully.

## 🌟 Key Features
* 🧠 **Advanced Sinhala AI:** Integrated with `gemini-flash-latest` for natural, conversational Sinhala chat natively.
* 🎙️ **Voice Note Processing:** Seamlessly capable of understanding and reading Sinhala voice notes.
* 📄 **ECCPMS PDF Engine:** Generates highly secure, beautifully formatted PDF reports directly in WhatsApp with strict Prefect ID verification protocols.
* 🎵 **Auto Media Downloader:** Simply paste a YouTube or Facebook link in chat! Olya auto-detects links and provides a highly-elegant smart menu for downloading Audio natively, Documents, or Voice Notes without specific commands.
* 🔐 **Secure Session Handling:** Environment variable-based (`.env`) repository design safely ensures that absolutely no API keys, private databases, or sessions are ever leaked publicly. 
* ✨ **Dynamic Status Modes:** The owner can easily set discrete statuses (`.mode coding/sleep`) while Olya intelligently handles incoming messages based on user hierarchies (e.g. VIP overrides for Chuti Miss).

## 🚀 Deployment Guide (Railway / Panels)

> **Important:** Never commit your `config.env` or `auth_info` folder to GitHub. This repo has a pre-configured `.gitignore`.

1. **Fork or Clone this safely configured Repository.**
2. Push your private custom version securely to **GitHub**.
3. Create a New Service on **Railway** (or any Cloud Host) and connect the linked repository.
4. **Navigate to the Railway Variables (RAW Editor) and establish your variables:**
   ```env
   SESSION_ID=your_session_id_here
   BOT_NUMBER=94742053080
   OWNER_NUMBER=94779912589
   OWNER_NAME=Hansaka
   GEMINI_API_KEYS=your_google_api_key_here
   ALIVE_IMG=https://i.ibb.co/s93hdn6L/Olya-welcome.png
   ALIVE_MSG="*Hello👋 Olya Assistant Is Alive Now😍*"
   ```
5. Deploy instantly and interact with your personal 24/7 AI secretary!

## 📜 Credits
Redesigned exclusively by **Hansaka P. Fernando**.
