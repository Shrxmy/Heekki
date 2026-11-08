// Replaces quick.db (its native build no longer compiles on modern Node) with Node's built-in SQLite.
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { PREFIX } = require("../config");
const { DEFAULT_JOIN_MESSAGE, DEFAULT_LEAVE_MESSAGE, DEFAULT_COLORS } = require("./greetings/format");

// The database file stays at the project root (it was there before this file moved into lib/).
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, "..", "json.sqlite"));
db.exec("CREATE TABLE IF NOT EXISTS prefixes (guild_id TEXT PRIMARY KEY, prefix TEXT NOT NULL)");
// NULL in a column means "use the default".
db.exec(`CREATE TABLE IF NOT EXISTS greet_settings (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT,
    join_enabled INTEGER NOT NULL DEFAULT 1,
    leave_enabled INTEGER NOT NULL DEFAULT 0,
    join_message TEXT,
    leave_message TEXT,
    colors TEXT,
    background BLOB
)`);

// Last.fm usernames people linked themselves (one per Discord user, used in every server).
db.exec("CREATE TABLE IF NOT EXISTS lastfm_users (user_id TEXT PRIMARY KEY, username TEXT NOT NULL)");
// Artist crowns per server: artist_key is the lowercased name, artist keeps Last.fm's spelling for display.
db.exec(`CREATE TABLE IF NOT EXISTS crowns (
    guild_id TEXT NOT NULL,
    artist_key TEXT NOT NULL,
    artist TEXT NOT NULL,
    user_id TEXT NOT NULL,
    plays INTEGER NOT NULL,
    PRIMARY KEY (guild_id, artist_key)
)`);
db.exec("CREATE TABLE IF NOT EXISTS coins (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, balance INTEGER NOT NULL, PRIMARY KEY (guild_id, user_id))");

const getStmt = db.prepare("SELECT prefix FROM prefixes WHERE guild_id = ?");
const setStmt = db.prepare("INSERT INTO prefixes (guild_id, prefix) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET prefix = excluded.prefix");

const getGreetStmt = db.prepare("SELECT * FROM greet_settings WHERE guild_id = ?");
const ensureGreetStmt = db.prepare("INSERT INTO greet_settings (guild_id) VALUES (?) ON CONFLICT(guild_id) DO NOTHING");
// Fixed whitelist: patch keys → column names (and how to store each value).
const GREET_COLUMNS = {
    channelId: ["channel_id", (v) => v],
    joinEnabled: ["join_enabled", (v) => (v ? 1 : 0)],
    leaveEnabled: ["leave_enabled", (v) => (v ? 1 : 0)],
    joinMessage: ["join_message", (v) => v],
    leaveMessage: ["leave_message", (v) => v],
    colors: ["colors", (v) => (v === null ? null : JSON.stringify(v))],
    background: ["background", (v) => v],
};
const updateGreetStmts = Object.fromEntries(Object.entries(GREET_COLUMNS).map(([key, [column]]) =>
    [key, db.prepare(`UPDATE greet_settings SET ${column} = ? WHERE guild_id = ?`)]));

function getGreetSettings(guildId) {
    const row = getGreetStmt.get(guildId);
    return {
        channelId: row?.channel_id ?? null,
        joinEnabled: row ? row.join_enabled === 1 : true,
        leaveEnabled: row ? row.leave_enabled === 1 : false,
        joinMessage: row?.join_message ?? DEFAULT_JOIN_MESSAGE,
        leaveMessage: row?.leave_message ?? DEFAULT_LEAVE_MESSAGE,
        colors: row?.colors ? JSON.parse(row.colors) : DEFAULT_COLORS,
        background: row?.background ? Buffer.from(row.background) : null,
    };
}

/** Saves only the keys present in `patch`; null for a message, colors or background restores its default. */
function updateGreetSettings(guildId, patch) {
    ensureGreetStmt.run(guildId);
    for (const [key, value] of Object.entries(patch)) {
        if (!GREET_COLUMNS[key]) throw new Error(`Unknown greeting setting: ${key}`);
        updateGreetStmts[key].run(GREET_COLUMNS[key][1](value), guildId);
    }
}

// Slot machine "moon coins", per server. New players start with 500; anyone who's broke gets 100 back.
const STARTING_COINS = 500, BAILOUT_COINS = 100;
const getCoinsStmt = db.prepare("SELECT balance FROM coins WHERE guild_id = ? AND user_id = ?");
const setCoinsStmt = db.prepare("INSERT INTO coins (guild_id, user_id, balance) VALUES (?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET balance = excluded.balance");
function getCoins(guildId, userId) {
    const balance = getCoinsStmt.get(guildId, userId)?.balance ?? STARTING_COINS;
    return balance > 0 ? balance : BAILOUT_COINS;
}
const setCoins = (guildId, userId, balance) => setCoinsStmt.run(guildId, userId, Math.max(0, Math.floor(balance)));

const getLastfmStmt = db.prepare("SELECT username FROM lastfm_users WHERE user_id = ?");
const setLastfmStmt = db.prepare("INSERT INTO lastfm_users (user_id, username) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username");
const removeLastfmStmt = db.prepare("DELETE FROM lastfm_users WHERE user_id = ?");
const allLastfmStmt = db.prepare("SELECT user_id, username FROM lastfm_users");

const getCrownStmt = db.prepare("SELECT artist, user_id, plays FROM crowns WHERE guild_id = ? AND artist_key = ?");
const setCrownStmt = db.prepare(`INSERT INTO crowns (guild_id, artist_key, artist, user_id, plays) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, artist_key) DO UPDATE SET artist = excluded.artist, user_id = excluded.user_id, plays = excluded.plays`);
const deleteCrownStmt = db.prepare("DELETE FROM crowns WHERE guild_id = ? AND artist_key = ?");
const crownsOfStmt = db.prepare("SELECT artist, plays FROM crowns WHERE guild_id = ? AND user_id = ? ORDER BY plays DESC, artist");
const crownKey = (artist) => String(artist).toLowerCase();

module.exports = {
    getLastfm: (userId) => getLastfmStmt.get(userId)?.username ?? null,
    setLastfm: (userId, username) => setLastfmStmt.run(userId, username),
    /** True if there was a link to remove. */
    removeLastfm: (userId) => removeLastfmStmt.run(userId).changes > 0,
    /** Map of Discord user id -> Last.fm username, for everyone who linked. */
    allLastfm: () => new Map(allLastfmStmt.all().map((r) => [r.user_id, r.username])),
    /** The crown for an artist in a server: { artist, user_id, plays } or null. */
    getCrown: (guildId, artist) => getCrownStmt.get(guildId, crownKey(artist)) ?? null,
    setCrown: (guildId, artist, userId, plays) => setCrownStmt.run(guildId, crownKey(artist), artist, userId, Math.floor(plays)),
    deleteCrown: (guildId, artist) => deleteCrownStmt.run(guildId, crownKey(artist)),
    /** Every crown a member holds in a server, most plays first. */
    crownsOf: (guildId, userId) => crownsOfStmt.all(guildId, userId),
    getCoins,
    setCoins,
    getCustomPrefix: (guildId) => getStmt.get(guildId)?.prefix ?? null,
    getPrefix: (guildId) => getStmt.get(guildId)?.prefix ?? PREFIX,
    setPrefix: (guildId, prefix) => setStmt.run(guildId, prefix),
    getGreetSettings,
    updateGreetSettings,
};
