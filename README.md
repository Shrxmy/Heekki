# Heekki

Discord music bot: discord.js v14 + Lavalink v4 (via `lavalink-client`).

## Requirements
- Node.js 22.13 or newer
- Docker (to run the Lavalink music server), or any Lavalink v4 server with the YouTube plugin

## Setup
1. **Discord Developer Portal** → your app → *Bot*:
   - Turn on **Message Content Intent** (needed for `-` prefix commands) and **Server Members Intent**
     (needed for join/leave greetings). Without both, Discord refuses the login.
   - Invite the bot with the `bot` and `applications.commands` scopes, and the Connect, Speak, Send Messages, Embed Links and Read Message History permissions.
2. `cp .env.example .env` and set `DISCORD_TOKEN`.
   For Spotify links, also set `SPOTIFY_ENABLED=true` and your Spotify client ID/secret.
   Also set `YT_CIPHER_PASSWORD` to any long random string (e.g. `openssl rand -hex 24`).
3. Start Lavalink and the YouTube cipher server: `docker compose up -d`. Wait about 30s on the first run while it downloads plugins.
4. **YouTube sign-in (one time):** YouTube blocks playback for most videos unless Lavalink is signed in.
   Run `docker compose logs lavalink | grep google.com/device`, open that page with a **spare Google account**
   (never your main one, bots can get it banned) and enter the code. Lavalink then logs
   `Token retrieved successfully ... (1//...)`. Put that `1//...` value in `.env` as `YOUTUBE_REFRESH_TOKEN=`
   and run `docker compose up -d --force-recreate` so you don't have to sign in again.
5. `npm install`
6. `npm start`

If you change `LAVALINK_PASSWORD`, change `password` in `config.json` to match.

## Commands
Every command works with the prefix (default `-`, change per server with `-setprefix`) **and** as a slash command (`/play`, `/trivia`, ...).

- **Music:** `play`/`p`, `queue`/`q`, `nowplaying`/`np`, `skip`, `stop`, `pause`, `resume`, `seek <seconds>`,
  `volume <1-100>`, `loop [queue]`, `bassboost <0-3>`, `8d`, `nightcore`, `karaoke`, `treblebass`, `filteroff`
- **Fun:** `slots [bet]` (LOONA slot machine with moon coins), `tictactoe @user`, `rps [@user]`, `trivia`, `8ball <question>`,
  `roll [2d6]`, `coinflip`, `cuterate` / `smartrate` / `dumbrate [@user]`, `love-calculator @user [@user]`, `hack @user` (a joke),
  `meme [kpop|loona]`, `motivation`, `snipe`, `snipeedit`, `emojify`, `fliptext`, `enchant`, `zalgo`, `decode <binary|base64>`
- **Utils:** `help`, `musichelp`, `setprefix`, `ping`
- **Greetings** (Manage Server only): `set-greet-channel`, `set-join-message`, `set-leave-message`, `set-greet-bg`,
  `set-greet-colors`, `toggle-join-greet`, `toggle-leave-greet`, `greet-settings`, `testjoin`, `testleave`

### Greetings
New members get a LOONA "twelve stars" card (avatar, name, member number, your welcome line) plus your message.
Placeholders: `{user}` (mention), `{username}`, `{server}`, `{count}`. Join is on and leave is off by default; nothing posts
until `set-greet-channel` is set. `testjoin` / `testleave` preview in the current channel and say if anything would stop the
real greeting. The bot needs **Attach Files** in the greeting channel (it isn't in the original invite permissions).
Backgrounds must be Discord uploads or Discord image links (PNG/JPEG/WebP, up to 8 MB).

### Voice channel
When the queue ends the bot stays in the voice channel; it leaves after being alone there for 3 minutes
(`ALONE_LEAVE_MS` in `events/voiceStateUpdate.js`). `stop` makes it leave right away.

### Slots
Spins the 12 member animals plus the 🌙 jackpot: any pair pays ×3, three of a kind ×40, three moons ×150
(about 93% paid back over time). Moon coins are per server; everyone starts with 500 and gets 100 back when broke.

### Snipe
`snipe` / `snipeedit` show the last deleted / edited message in a channel. They're kept in memory only, for 15 minutes.

## Project layout
`commands/<category>/` one file per command · `events/` Discord event handlers · `handler/` command loading and the
slash-command adapter · `greetings/` and `fun/` shared logic · `db.js` storage (SQLite) · `lavalink/` music server config ·
`docs/greetings-design.md` design notes for the welcome cards.

## Tests
`npm test`
