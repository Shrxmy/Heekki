// Postgres on Neon, from DATABASE_URL (pulled into .env by `neon deploy`). Every function is async.
// Tests set DATABASE_URL=memory to get an in-process Postgres (PGlite) instead.
const { PREFIX } = require("../config");
const { DEFAULT_JOIN_MESSAGE, DEFAULT_LEAVE_MESSAGE, DEFAULT_COLORS } = require("./greetings/format");
const storage = require("./storage");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Run `neon env pull` to put it in .env.");
let pool;
if (url === "memory") {
    pool = new (require("@electric-sql/pglite").PGlite)();
} else {
    // Neon's URL says sslmode=require; pg treats that as verify-full today, and saying so keeps it when pg 9 changes the meaning.
    pool = new (require("pg").Pool)({ connectionString: url.replace("sslmode=require", "sslmode=verify-full") });
    // Neon closes idle connections when the database scales to zero; without this listener that would crash the bot.
    pool.on("error", (err) => console.error(`Database connection dropped: ${err.message}`));
}

const SCHEMA = [
    "CREATE TABLE IF NOT EXISTS prefixes (guild_id TEXT PRIMARY KEY, prefix TEXT NOT NULL)",
    // NULL in a column means "use the default". The background image itself lives in object storage.
    `CREATE TABLE IF NOT EXISTS greet_settings (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT,
        join_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        leave_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        join_message TEXT,
        leave_message TEXT,
        colors TEXT,
        has_background BOOLEAN NOT NULL DEFAULT FALSE,
        birthday_enabled BOOLEAN NOT NULL DEFAULT TRUE
    )`,
    // Last.fm usernames people linked themselves (one per Discord user, used in every server).
    "CREATE TABLE IF NOT EXISTS lastfm_users (user_id TEXT PRIMARY KEY, username TEXT NOT NULL)",
    // Artist crowns per server: artist_key is the lowercased name, artist keeps Last.fm's spelling for display.
    `CREATE TABLE IF NOT EXISTS crowns (
        guild_id TEXT NOT NULL,
        artist_key TEXT NOT NULL,
        artist TEXT NOT NULL,
        user_id TEXT NOT NULL,
        plays INTEGER NOT NULL,
        PRIMARY KEY (guild_id, artist_key)
    )`,
    "CREATE TABLE IF NOT EXISTS coins (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, balance INTEGER NOT NULL, PRIMARY KEY (guild_id, user_id))",
    // One LOONA birthday post per member, per server, per year (Korea time), so restarts don't post twice.
    "CREATE TABLE IF NOT EXISTS birthday_posts (guild_id TEXT NOT NULL, member_key TEXT NOT NULL, year INTEGER NOT NULL, PRIMARY KEY (guild_id, member_key, year))",
];

// Tables are created on first use; if the database was unreachable, the next query tries again.
let ready;
const init = () => (ready ??= (async () => { for (const sql of SCHEMA) await pool.query(sql); })()
    .catch((err) => { ready = undefined; throw err; }));
async function query(sql, params = []) {
    await init();
    return (await pool.query(sql, params)).rows;
}
const first = async (sql, params) => (await query(sql, params))[0] ?? null;

// Fixed whitelist: patch keys → column names (and how to store each value). `background` is handled separately.
const GREET_COLUMNS = {
    channelId: ["channel_id", (v) => v],
    joinEnabled: ["join_enabled", Boolean],
    leaveEnabled: ["leave_enabled", Boolean],
    joinMessage: ["join_message", (v) => v],
    leaveMessage: ["leave_message", (v) => v],
    colors: ["colors", (v) => (v === null ? null : JSON.stringify(v))],
    birthdayEnabled: ["birthday_enabled", Boolean],
};
const backgroundKey = (guildId) => `greet-backgrounds/${guildId}`;

async function getGreetSettings(guildId) {
    const row = await first("SELECT * FROM greet_settings WHERE guild_id = $1", [guildId]);
    return {
        channelId: row?.channel_id ?? null,
        joinEnabled: row ? row.join_enabled : true,
        leaveEnabled: row ? row.leave_enabled : false,
        joinMessage: row?.join_message ?? DEFAULT_JOIN_MESSAGE,
        leaveMessage: row?.leave_message ?? DEFAULT_LEAVE_MESSAGE,
        colors: row?.colors ? JSON.parse(row.colors) : DEFAULT_COLORS,
        hasBackground: row ? row.has_background : false,
        birthdayEnabled: row ? row.birthday_enabled : true,
    };
}

/**
 * Saves only the keys present in `patch`; null for a message, colors or background restores its default.
 * `background` is image bytes (stored in object storage) or null.
 */
async function updateGreetSettings(guildId, patch) {
    await query("INSERT INTO greet_settings (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING", [guildId]);
    for (const [key, value] of Object.entries(patch)) {
        if (key === "background") continue;
        if (!GREET_COLUMNS[key]) throw new Error(`Unknown greeting setting: ${key}`);
        const [column, store] = GREET_COLUMNS[key];
        await query(`UPDATE greet_settings SET ${column} = $1 WHERE guild_id = $2`, [store(value), guildId]);
    }
    if (!("background" in patch)) return;
    if (patch.background) {
        await storage.put(backgroundKey(guildId), patch.background); // upload first, so the flag never points at nothing
        await query("UPDATE greet_settings SET has_background = TRUE WHERE guild_id = $1", [guildId]);
    } else {
        await query("UPDATE greet_settings SET has_background = FALSE WHERE guild_id = $1", [guildId]);
        await storage.remove(backgroundKey(guildId)).catch((err) => console.error(`Couldn't delete background of ${guildId}: ${err.message}`));
    }
}

/** The server's custom card background, or null (no background set, or it couldn't be loaded). */
async function getGreetBackground(guildId) {
    try {
        return await storage.get(backgroundKey(guildId));
    } catch (err) {
        console.error(`Couldn't load background of ${guildId}: ${err.message}`);
        return null;
    }
}

// Slot machine "moon coins", per server. New players start with 500; anyone who's broke gets 100 back.
const STARTING_COINS = 500, BAILOUT_COINS = 100;
const EFFECTIVE = `(CASE WHEN balance > 0 THEN balance ELSE ${BAILOUT_COINS} END)`;
async function getCoins(guildId, userId) {
    const balance = (await first("SELECT balance FROM coins WHERE guild_id = $1 AND user_id = $2", [guildId, userId]))?.balance ?? STARTING_COINS;
    return balance > 0 ? balance : BAILOUT_COINS;
}
/**
 * Spends `bet` and adds `won` in one statement, so two quick spins can't both spend the same coins.
 * Returns the new balance, or null if the player doesn't have `bet` coins.
 */
async function betCoins(guildId, userId, bet, won) {
    await query("INSERT INTO coins (guild_id, user_id, balance) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [guildId, userId, STARTING_COINS]);
    const row = await first(`UPDATE coins SET balance = GREATEST(0, ${EFFECTIVE} - $3 + $4)
        WHERE guild_id = $1 AND user_id = $2 AND ${EFFECTIVE} >= $3 RETURNING balance`, [guildId, userId, bet, won]);
    return row?.balance ?? null;
}

const crownKey = (artist) => String(artist).toLowerCase();

module.exports = {
    getLastfm: async (userId) => (await first("SELECT username FROM lastfm_users WHERE user_id = $1", [userId]))?.username ?? null,
    setLastfm: (userId, username) => query("INSERT INTO lastfm_users (user_id, username) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET username = excluded.username", [userId, username]),
    /** True if there was a link to remove. */
    removeLastfm: async (userId) => (await query("DELETE FROM lastfm_users WHERE user_id = $1 RETURNING user_id", [userId])).length > 0,
    /** Map of Discord user id -> Last.fm username, for everyone who linked. */
    allLastfm: async () => new Map((await query("SELECT user_id, username FROM lastfm_users")).map((r) => [r.user_id, r.username])),
    /** The crown for an artist in a server: { artist, user_id, plays } or null. */
    getCrown: (guildId, artist) => first("SELECT artist, user_id, plays FROM crowns WHERE guild_id = $1 AND artist_key = $2", [guildId, crownKey(artist)]),
    setCrown: (guildId, artist, userId, plays) => query(`INSERT INTO crowns (guild_id, artist_key, artist, user_id, plays) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (guild_id, artist_key) DO UPDATE SET artist = excluded.artist, user_id = excluded.user_id, plays = excluded.plays`,
        [guildId, crownKey(artist), artist, userId, Math.floor(plays)]),
    deleteCrown: (guildId, artist) => query("DELETE FROM crowns WHERE guild_id = $1 AND artist_key = $2", [guildId, crownKey(artist)]),
    /** Every crown a member holds in a server, most plays first. */
    crownsOf: (guildId, userId) => query("SELECT artist, plays FROM crowns WHERE guild_id = $1 AND user_id = $2 ORDER BY plays DESC, artist", [guildId, userId]),
    getCoins,
    betCoins,
    getCustomPrefix: async (guildId) => (await first("SELECT prefix FROM prefixes WHERE guild_id = $1", [guildId]))?.prefix ?? null,
    getPrefix: async (guildId) => (await first("SELECT prefix FROM prefixes WHERE guild_id = $1", [guildId]))?.prefix ?? PREFIX,
    setPrefix: (guildId, prefix) => query("INSERT INTO prefixes (guild_id, prefix) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET prefix = excluded.prefix", [guildId, prefix]),
    getGreetSettings,
    updateGreetSettings,
    getGreetBackground,
    /** True the first time it's called for this server, member and year; false if that post was already made. */
    claimBirthdayPost: async (guildId, memberKey, year) => (await query(
        "INSERT INTO birthday_posts (guild_id, member_key, year) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING guild_id", [guildId, memberKey, year])).length > 0,
    /** Gives the claim back after a failed post, so the next check retries it. */
    unclaimBirthdayPost: (guildId, memberKey, year) => query("DELETE FROM birthday_posts WHERE guild_id = $1 AND member_key = $2 AND year = $3", [guildId, memberKey, year]),
};
