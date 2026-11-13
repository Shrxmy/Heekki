// Last.fm: API calls plus the bits every fm command shares. Needs LASTFM_API_KEY in .env (free at last.fm/api).
const { escapeMarkdown } = require("discord.js");
const http = require("../info/http");
const { getLastfm } = require("../db");
const { targetMember, quiet } = require("../fun/target");

const API = "https://ws.audioscrobbler.com/2.0/";

class LastfmError extends Error {
    constructor(message, { notFound = false } = {}) {
        super(message);
        this.notFound = notFound;
    }
}

const hasKey = () => Boolean(process.env.LASTFM_API_KEY);

/** Calls a Last.fm API method. Throws LastfmError (notFound for unknown users/artists/tracks). */
async function call(method, params) {
    const query = new URLSearchParams({ method, ...params, api_key: process.env.LASTFM_API_KEY ?? "", format: "json" });
    let data;
    try {
        data = await http.getJson(`${API}?${query}`);
    } catch (err) {
        // Last.fm answers unknown users and artists with HTTP 404 (or 400 for some methods).
        throw new LastfmError(err.message, { notFound: /HTTP 40[04]/.test(err.message) });
    }
    // Error 6 = user/artist/track not found, sometimes sent with HTTP 200.
    if (data?.error) throw new LastfmError(String(data.message ?? "Last.fm error"), { notFound: data.error === 6 });
    return data;
}

// Last.fm usernames: 2-15 characters, starting with a letter.
const validUsername = (name) => /^[A-Za-z][\w-]{1,14}$/.test(name ?? "");

// What people type (prefix) or pick (slash) -> Last.fm's period names.
const PERIODS = {
    week: { api: "7day", label: "this week" },
    month: { api: "1month", label: "this month" },
    "3months": { api: "3month", label: "the last 3 months" },
    "6months": { api: "6month", label: "the last 6 months" },
    year: { api: "12month", label: "this year" },
    alltime: { api: "overall", label: "all time" },
};
const PERIOD_CHOICES = Object.keys(PERIODS).map((key) => ({ name: key, value: key }));
/** The period named anywhere in args (default: this week). */
const periodFrom = (args) => PERIODS[args.map((a) => a.toLowerCase()).find((a) => Object.hasOwn(PERIODS, a))] ?? PERIODS.week;

/** Who the command is about (a mentioned member, else the author) and their linked username, or a reply explaining what's missing. */
async function whoFrom(message, args) {
    const mention = args.find((a) => /^(?:<@!?)?\d{17,20}>?$/.test(a));
    const member = await targetMember(message, mention);
    if (!member) return { problem: "I couldn't find that member 🌙" };
    const username = await getLastfm(member.id);
    if (!username) {
        return { problem: member.id === message.author.id
            ? "I don't know your Last.fm yet, Orbit. Link it with `fmset <username>` 🌙"
            : `**${escapeMarkdown(member.displayName)}** hasn't linked their Last.fm yet 🌙` };
    }
    return { member, username };
}

const NO_KEY = "Last.fm isn't set up on this bot yet. The bot owner needs to add `LASTFM_API_KEY` to `.env` 🌙";

/** Names from Last.fm are outside data: no markdown, no breaking out of [link text]. */
const clean = (text, max = 100) => escapeMarkdown(String(text ?? "").slice(0, max)).replace(/([[\]])/g, "\\$1");
/** A Last.fm page URL that is safe inside markdown link brackets, or null. */
function pageUrl(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== "https:" || u.hostname !== "www.last.fm") return null;
        const safe = u.href.replace(/[()[\]<>\s]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
        return safe.length <= 300 ? safe : null; // a huge URL would blow Discord's embed limits
    } catch {
        return null;
    }
}
/** A markdown link, only to Last.fm itself. */
const link = (text, url, max) => (pageUrl(url) ? `[${clean(text, max)}](${pageUrl(url)})` : clean(text, max));

// Last.fm's grey star placeholder means "no art"; anything not on its image CDN is ignored.
const PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";
const IMAGE_HOSTS = new Set(["lastfm.freetls.fastly.net", "lastfm-img.freetls.fastly.net"]); // the API uses both
/** The largest real image from a Last.fm `image` array, or null. */
function imageUrl(images) {
    const url = [].concat(images ?? []).map((i) => i?.["#text"]).filter(Boolean).at(-1);
    if (!url || url.includes(PLACEHOLDER)) return null;
    try {
        const u = new URL(url);
        return u.protocol === "https:" && IMAGE_HOSTS.has(u.hostname) ? u.href : null;
    } catch {
        return null;
    }
}

/** The latest scrobble of a Last.fm user ({ artist, name, album, url, image, live, uts }), or null if they have none. */
async function latestTrack(username) {
    const recent = (await call("user.getRecentTracks", { user: username, limit: "1" })).recenttracks;
    const t = [].concat(recent?.track ?? [])[0];
    if (!t) return null;
    return { artist: t.artist?.["#text"] ?? t.artist?.name ?? "", name: t.name, album: t.album?.["#text"] ?? "", url: t.url,
        image: t.image, live: t["@attr"]?.nowplaying === "true", uts: Number(t.date?.uts) || null, total: recent["@attr"]?.total };
}

/** "LOONA - Butterfly" -> ["LOONA", "Butterfly"], or null without a " - ". */
function splitPair(text) {
    const at = String(text ?? "").indexOf(" - ");
    if (at < 1) return null;
    const pair = [text.slice(0, at).trim(), text.slice(at + 3).trim()];
    return pair[0] && pair[1] ? pair : null;
}

const plural = (n, word) => `${Number(n).toLocaleString("en-US")} ${word}${Number(n) === 1 ? "" : "s"}`;

module.exports = { latestTrack, splitPair, pageUrl, quiet, call, hasKey, LastfmError, validUsername, PERIODS, PERIOD_CHOICES, periodFrom, whoFrom, NO_KEY, clean, link, imageUrl, plural };
