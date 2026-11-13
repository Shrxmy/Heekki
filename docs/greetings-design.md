# Greetings (welcome / leave cards): design

## Intent
Rebuild the lost bot's Greetings feature inside this bot (discord.js v14, `commands/<category>/` layout,
prefix + slash via `handler/slashAdapter.js`, settings in Neon Postgres via `db.js`, backgrounds in Neon Object Storage via `storage.js`).
Greetings and Fun were what the server actually used. The server is a LOONA fan server, so the
card has a LOONA look: the **"twelve stars"** design the owner picked from mockups. Twelve coloured stars orbit the
new member's round avatar, with their name, member number and a welcome line on the right, on a night-sky background.

## Goals
- When a member joins, post one greeting in the configured channel: the customizable message text (with a
  mention of the new member) and the card image attached.
- When a member leaves, post the same style with a leave message (no mention needed).
- Server-wide customization by admins (one look for the whole server, not per member):
  - greeting channel
  - join message and leave message, with placeholders `{user}` (mention), `{username}`, `{server}`, `{count}`
  - background: drawn night sky (default) or an uploaded image
  - the 12 star colours
  - join and leave each switched on/off independently
- Test commands so admins can preview the join and leave greeting without anyone actually joining.

## Non-goals
- Per-member customization (e.g. picking a "bias" star). The owner chose universal settings.
- A separate "embed-only" greeting mode. The old bot had both a canvas mode and an embed mode;
  this version has one greeting: message + card. *(My call: it covers what the old embed mode did,
  with fewer settings to explain.)*
- Official LOONA logos or member photos baked into the bot. Admins can upload any background they like.
- Levels, giveaways, other categories: separate projects.

## Anti-goals (fails even if it "works")
- The bot can be used to fetch arbitrary URLs (e.g. `http://localhost:2333`, the Lavalink server) or to
  download huge files.
- A greeting can ping `@everyone`/roles, or ping anyone other than the new member.
- A broken setting (deleted channel, missing permission, bad image) crashes the bot or spams errors in chat.
- Names in Korean (or other non-Latin scripts) render as empty boxes. This is a K-pop server, so many will.

## Constraints
- Rendering: **`@napi-rs/canvas`**, pinned to **1.0.13** (MIT, ~51M weekly downloads, no install scripts, ships prebuilt
  binaries; 1.1.0 is too new). The owner asked for "secure and clean"; approaches below.
- Storage: Neon Postgres (`db.js`); background images in the Neon `assets` bucket (`storage.js`). (Originally `node:sqlite`.)
- Commands follow the existing module shape `{ name, description, aliases, options?, defaultMemberPermissions?, run }`.
  Settings are separate commands (like the old bot's separate files), not one command with subcommands.
- *(My call, after the builder check:)* the slash adapter's "at most one option" shortcut is removed. `toArgs` builds args
  in the order the command **declares** its options (filling skipped optional ones with nothing), and slash attachment options are
  exposed as `message.attachments` (like a real Message), not as args. `set-greet-bg` is the first command to use both.
  The one-option test changes to "options are declared in the order prefix args use them".
- Settings commands need **Manage Server** (`defaultMemberPermissions` for slash, and a permission check in `run` for prefix).
- Discord needs the privileged **Server Members** intent for join/leave events (enable in the Developer Portal),
  plus `Partials.GuildMember` so leaves of uncached members still fire.
- The bot needs **Attach Files** in the greeting channel. The owner's current invite permissions (274881137664)
  don't include it, so the README must say so.

## Approaches considered
- **A. `@napi-rs/canvas`: draw the PNG in code.** *(Chosen: the owner said "any secure and clean package", and this is
  the cleanest: prebuilt, no compile step, widely used.)* Design tweaks happen in drawing code.
- B. SVG template → PNG via `@resvg/resvg-js`. Easier to tweak visually, but fonts and avatars need extra plumbing.
- Dropped: headless browser (hundreds of MB), external card-image web service (third party can vanish).

## Decided details
- **Commands** (category folder `greetings`, already has a 👋 slot in the help menu):
  | command | does |
  |---|---|
  | `set-greet-channel <#channel>` | where greetings go |
  | `set-join-message <text>` / `set-leave-message <text>` | message text with placeholders; `reset` restores default |
  | `set-greet-bg <image upload or Discord image link>` | custom background; `reset` returns to the drawn sky. Slash: optional `image` (attachment) + optional `link_or_reset` (text) |
  | `set-greet-colors <12 hex colours>` | star colours; `reset` restores defaults |
  | `toggle-join-greet` / `toggle-leave-greet` | on/off |
  | `greet-settings` | shows the current settings |
  | `testjoin` / `testleave` | posts a preview using the person who ran it |

  *(My calls, after the builder check:)* **all** greetings commands, including `greet-settings` and the tests, need Manage Server.
  `testjoin`/`testleave` post the preview **in the channel where they're run**, so admins can try it before any setup and
  without a fake welcome showing up for the whole server. They work even when no channel is set or the greeting is switched off.
  They reuse the real message + card building, and add a short warning line under the preview when the real greeting
  wouldn't post (no channel set, greeting switched off, or the bot lacks View Channel / Send Messages / Attach Files there).
- **Defaults:** join message `Welcome to the Orbit, {user}! 🌙`, leave message `{username} left the Orbit. 🌙`;
  join on, leave off, until a channel is set nothing is posted.
- **Card:** 1024×400 PNG. Text on the card: `MEMBER #{count}`, the display name, and the message rendered as
  plain text (`{user}` becomes the display name, no mention markup), truncated with "…" to fit. The 12 stars sit on a
  ring around the avatar with a soft glow, matching the approved mockup.
- **Background uploads (security):** accept only `https://cdn.discordapp.com/...` or `https://media.discordapp.net/...`
  (an attachment on the command or a pasted Discord image link), image content-type png/jpeg/webp, at most 8 MB,
  with a download timeout. Download **once** when set (Discord attachment links expire), crop/resize to 1024×400, and
  store the resulting PNG in the database. Never fetch the URL again at greeting time.
- **Mentions:** greeting posts allow mentioning only the new member (`allowedMentions: { users: [member.id] }`).
- **Fonts:** bundle open-licence fonts in `assets/fonts/` covering Latin and Korean (e.g. Noto Sans + Noto Sans KR)
  and register them with the canvas. Don't rely on whatever the host has installed.
- **Failures:** missing channel/permissions or a render error → log one line and skip that greeting
  (real join/leave events). Admins get feedback through the test commands' warning line.
- **Downloads:** don't follow redirects when fetching a background (a redirect could point away from Discord's CDN).

## Left to the builder
- Exact drawing code, glow, font sizes, truncation rules, so long as it matches the approved mockup's look.
- Default 12 star colours: research LOONA's member colours and use them, noting the source in a comment;
  if they can't be confirmed, use the mockup's rainbow palette.
- Database schema shape (one `greet_settings` row per guild is fine).
- How emoji in messages render on the card (stripping them from the card text is acceptable).
- Tests: placeholder rendering, colour parsing, URL validation, and one rendered sample PNG checked by eye.
