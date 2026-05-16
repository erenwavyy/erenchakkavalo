# 🎯 Valorant Discord Stats Bot  v2.0

Automatically posts a **match stat card** as a PNG image to Discord after every Valorant game.

- ✅ **Canvas rendering** — no browser, no Puppeteer, runs on any server
- ✅ **Real RR tracking** — uses official Riot API for accurate rank/RR changes
- ✅ **Railway / Render ready** — includes all config files
- ✅ **Auto-retry & error recovery** — won't crash on API blips

---

## 📸 What gets posted

Each match triggers:
- A **PNG card image** with full 10-player scoreboard
- A **Discord embed** showing your KDA, ACS, ADR, HS%, K/D, and real RR change
- Highlighted "YOU" row in the scoreboard

---

## 🚀 Deploy to Railway (Recommended — Free tier available)

### Step 1 — Create Discord Bot
1. Go to [discord.com/developers](https://discord.com/developers/applications) → **New Application**
2. **Bot** tab → **Reset Token** → copy it
3. **Bot** tab → disable "Public Bot"
4. **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Attach Files`, `Embed Links`, `View Channels`
5. Open the generated URL → invite bot to your server
6. Enable **Developer Mode** in Discord: Settings → Advanced → Developer Mode
7. Right-click your target channel → **Copy Channel ID**

### Step 2 — Get Riot API Key
1. Go to [developer.riotgames.com](https://developer.riotgames.com)
2. Sign in → **Dashboard** → copy your **Development API Key**
3. ⚠️ Development keys expire every **24 hours** — regenerate as needed
4. For permanent use: submit a **Production** application (free, takes a few days)

### Step 3 — Deploy to Railway
1. Push this folder to a **GitHub repo**
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Select your repo
4. Go to **Variables** tab and add:

```
DISCORD_TOKEN     = your_bot_token
CHANNEL_ID        = your_channel_id
RIOT_NAME         = YourName
RIOT_TAG          = TAG
REGION            = na
RIOT_API_KEY      = RGAPI-xxxx-...
POLL_INTERVAL     = 60000
```

5. Railway will auto-build and start. Check **Logs** tab — you should see:
```
✅  Bot online as YourBot#1234
🔖  Seeded last match ID: ...
```

Done! Play a game and the bot will post within ~1 minute of it ending. 🎮

---

## 🚀 Deploy to Render (Alternative)

1. Push to GitHub
2. [render.com](https://render.com) → **New** → **Background Worker**
3. Connect your repo
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `node index.js`
6. Add all the same environment variables
7. Deploy!

---

## 🗂 Project Structure

```
valorant-bot-v2/
├── index.js                  ← Main bot + polling logic
├── package.json
├── railway.toml              ← Railway deployment config
├── nixpacks.toml             ← System libs for Canvas on Linux
├── .env.example              ← Copy to .env for local dev
└── src/
    ├── api/
    │   ├── henrik.js         ← Match data (free, no key)
    │   └── riot.js           ← Rank / RR data (official API)
    ├── card/
    │   └── renderer.js       ← Canvas PNG card renderer
    └── utils/
        └── logger.js         ← Timestamped console logger
```

---

## 🔧 Local Development

```bash
# Install deps
npm install

# Copy and fill in .env
cp .env.example .env
nano .env

# Run
npm run dev     # with nodemon (auto-restart)
# or
npm start
```

---

## ❓ FAQ

**Q: My Riot API key keeps expiring**
Development keys last 24h. Go to [developer.riotgames.com](https://developer.riotgames.com) daily to renew, or apply for a production key.

**Q: Canvas fails to install**
On Ubuntu/Debian: `sudo apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`
Railway/Render handle this automatically via `nixpacks.toml`.

**Q: Bot posts on startup (old match)**
It shouldn't — the bot seeds `lastMatchId` before posting. If it does, wait for the next real match.

**Q: RR shows "—"**
The Riot ranked endpoint may not be available in your region or the rank data is delayed. The bot will still post the card, just without RR.

**Q: How do I track multiple players?**
Duplicate the `RIOT_NAME`/`RIOT_TAG` in `.env` and run a second bot instance pointing to a different channel.

---

## 📦 Dependencies

| Package      | Purpose                              |
|-------------|--------------------------------------|
| `discord.js` | Discord API client                   |
| `canvas`     | Node-canvas for PNG card rendering   |
| `axios`      | HTTP requests to APIs                |
| `dotenv`     | Load `.env` config file              |

---

MIT License — free to use, modify, share.
