// Server-wide Last.fm rankings (who knows an artist/track/album) and artist crowns.
const lastfm = require("./index");
const db = require("../db");
const { ensureMembers } = require("../info/resolve");
const { memberFor } = require("../loona");
const { musicEmbed, emoji } = require("../music/embed");

// One Last.fm call per linked member, a few at a time to stay well under Last.fm's rate limit.
// shortcut: only the first 30 linked members are checked; cache play counts if servers grow past that.
const MAX_CHECKED = 30, AT_ONCE = 5, SHOWN = 10;

/**
 * Plays for every linked member of this server, from playsOf(username) -> number.
 * A failed lookup is marked `failed`, never counted as zero plays.
 * Returns { linked: Set of linked member ids, counts, failed, listeners (plays > 0, most first) }.
 */
async function rankServer(guild, playsOf) {
    await ensureMembers(guild);
    const linked = [...await db.allLastfm()].filter(([id]) => guild.members.cache.has(id));
    const people = linked.slice(0, MAX_CHECKED);
    const counts = [];
    for (let i = 0; i < people.length; i += AT_ONCE) {
        counts.push(...await Promise.all(people.slice(i, i + AT_ONCE).map(([id, username]) =>
            Promise.resolve().then(() => playsOf(username))
                .then((plays) => ({ id, plays: Number(plays) || 0 }))
                .catch(() => ({ id, failed: true })))));
    }
    return {
        linked: new Set(linked.map(([id]) => id)),
        counts,
        failed: counts.filter((c) => c.failed).length,
        listeners: counts.filter((c) => !c.failed && c.plays > 0).sort((a, b) => b.plays - a.plays),
    };
}

/**
 * Who holds an artist's crown after a ranking: { userId, plays, takenFrom? }, or null for no crown.
 * Only a confirmed higher play count takes a crown: ties keep it, and an unknown holder (lookup failed,
 * or not among the members checked) keeps it too.
 */
function decideCrown(current, { linked, counts, listeners }) {
    const top = listeners[0];
    if (!current) return top ? { userId: top.id, plays: top.plays } : null;
    const gone = !linked.has(current.user_id); // unlinked, or left the server
    const holder = counts.find((c) => c.id === current.user_id);
    if (!gone && (!holder || holder.failed)) return { userId: current.user_id, plays: current.plays };
    const holderPlays = gone ? 0 : holder.plays;
    if (top && top.id !== current.user_id && top.plays > holderPlays) return { userId: top.id, plays: top.plays, takenFrom: current.user_id };
    return holderPlays > 0 ? { userId: current.user_id, plays: holderPlays } : null;
}

/** Applies decideCrown to the database and returns its result. */
async function updateCrown(guildId, artist, ranking) {
    const result = decideCrown(await db.getCrown(guildId, artist), ranking);
    if (result) await db.setCrown(guildId, artist, result.userId, result.plays);
    else await db.deleteCrown(guildId, artist);
    return result;
}

/**
 * What a who-knows style command is about: the typed text, or (when empty) taken from the author's latest scrobble.
 * pick(track) returns the text to use, or "" if that scrobble doesn't have it. Returns { text } or { problem }.
 */
async function subjectFrom(message, args, pick, example) {
    const typed = args.join(" ").trim();
    if (typed) return { text: typed };
    const mine = await db.getLastfm(message.author.id);
    if (!mine) return { problem: `Which one, Orbit? Try \`${example}\`, or link your Last.fm with \`fmset\` to use what you're playing 🌙` };
    const track = await lastfm.latestTrack(mine).catch(() => null);
    const text = track ? pick(track) : "";
    return text ? { text } : { problem: `Which one, Orbit? Try \`${example}\` 🌙` };
}

const displayName = (guild, id) => lastfm.clean(guild.members.cache.get(id)?.displayName ?? "Someone", 32);

/** The ranking as an embed: crown holder marked 👑, the author in bold. */
function rankingEmbed(message, { title, url, ranking, crownHolder, note }) {
    const { guild } = message;
    const rows = ranking.listeners.slice(0, SHOWN).map(({ id, plays }, i) => {
        const name = id === message.author.id ? `**${displayName(guild, id)}**` : displayName(guild, id);
        return `${id === crownHolder ? "👑" : `\`${i + 1}.\``} ${name} · ${lastfm.plural(plays, "play")}`;
    });
    const total = ranking.listeners.reduce((sum, c) => sum + c.plays, 0);
    const host = memberFor(title);
    const checked = ranking.counts.length;
    return musicEmbed(host)
        .setAuthor({ name: `${emoji(host)} ${guild.name}`.slice(0, 256), iconURL: guild.iconURL?.() ?? undefined })
        .setTitle(`Who knows ${title}?`.slice(0, 256))
        .setURL(lastfm.pageUrl(url))
        .setDescription([rows.join("\n") || "Nobody here has scrobbled it yet. Time to start, Orbit 🌙", note].filter(Boolean).join("\n\n").slice(0, 4096))
        .setFooter({ text: `🌙 ${lastfm.plural(ranking.listeners.length, "listener")} · ${lastfm.plural(total, "play")} · ${checked} linked member${checked === 1 ? "" : "s"} checked${ranking.failed ? ` (${ranking.failed} couldn't be loaded)` : ""}` });
}

module.exports = { MAX_CHECKED, rankServer, decideCrown, updateCrown, subjectFrom, rankingEmbed, displayName };
