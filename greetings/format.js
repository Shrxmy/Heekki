// Text helpers for greetings. Must not require db.js (db.js imports the defaults from here).

const DEFAULT_JOIN_MESSAGE = "Welcome to the Orbit, {user}! 🌙";
const DEFAULT_LEAVE_MESSAGE = "{username} left the Orbit. 🌙";
const MAX_MESSAGE_LENGTH = 500;
const MAX_POST_LENGTH = 1900; // stays under Discord's 2000-char message limit

// LOONA member colours in debut order. Colour names from fan wikis (loonatheworld.fandom.com,
// wiki.d-addicts.com/Loona); the exact shades are our own match, since no official hex codes are published.
const DEFAULT_COLORS = [
    "#FF0092", // Heejin: bright pink
    "#FFD700", // Hyunjin: yellow
    "#00A651", // Haseul: green
    "#FF7F00", // Yeojin: orange
    "#FFB7CE", // ViVi: light pink
    "#E4002B", // Kim Lip: red
    "#1F4FD8", // JinSoul: blue
    "#7B3FBF", // Choerry: purple
    "#800020", // Yves: burgundy
    "#FFAA85", // Chuu: peach
    "#7ED957", // Go Won: "Eden green"
    "#C0C0C0", // Olivia Hye: silver
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
