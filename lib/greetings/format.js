// Text helpers for greetings. Must not require db.js (db.js imports the defaults from here).

const DEFAULT_JOIN_MESSAGE = "Welcome to the Orbit, {user}! 🌙";
const DEFAULT_LEAVE_MESSAGE = "{username} left the Orbit. 🌙";
const MAX_MESSAGE_LENGTH = 500;
const MAX_POST_LENGTH = 1900; // stays under Discord's 2000-char message limit

// LOONA's official member colours in debut order (each member's shape colour on loonatheworld.fandom.com).
const DEFAULT_COLORS = [
    "#F4028E", // HeeJin: vivid pink
    "#FFCB07", // HyunJin: yellow
    "#01954A", // HaSeul: green
    "#F47021", // YeoJin: orange
    "#F4A1B5", // ViVi: light pink
    "#EB1326", // Kim Lip: red
    "#1313D6", // JinSoul: blue
    "#7632A0", // Choerry: purple
    "#7A0332", // Yves: burgundy
    "#F7917E", // Chuu: peach
    "#39BB9D", // Go Won: Eden green
    "#787A7D", // HyeJu (Olivia Hye): silver
];

const fill = (template, vars, user) => template
    .replaceAll("{user}", user)
    .replaceAll("{username}", vars.username)
    .replaceAll("{server}", vars.server)
    .replaceAll("{count}", String(vars.count));

/** The message text for the post: {user} becomes a real mention. */
const fillPlaceholders = (template, vars) => fill(template, vars, vars.mention).slice(0, MAX_POST_LENGTH);

const DISCORD_MARKUP = /<(?:@[!&]?|#|a?:\w+:)\d+>/g; // user/role/channel mentions and custom emoji
const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu;

/** The line drawn on the card: plain text, {user} becomes the name, no markup or emoji. */
const cardLine = (template, vars) => fill(template, vars, vars.username)
    .replace(DISCORD_MARKUP, "")
    .replace(EMOJI, "")
    .replace(/\s+/g, " ")
    .trim();

/** 12 hex colours (with or without #, 3 or 6 digits, split by spaces/commas) → "#RRGGBB" list, else null. */
function parseColors(text) {
    const parts = String(text).split(/[\s,]+/).filter(Boolean);
    if (parts.length !== 12) return null;
    const colors = [];
    for (const part of parts) {
        const hex = part.replace(/^#/, "");
        if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;
        const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
        colors.push(`#${full.toUpperCase()}`);
    }
    return colors;
}

module.exports = {
    DEFAULT_JOIN_MESSAGE, DEFAULT_LEAVE_MESSAGE, DEFAULT_COLORS, MAX_MESSAGE_LENGTH,
    fillPlaceholders, cardLine, parseColors,
};
