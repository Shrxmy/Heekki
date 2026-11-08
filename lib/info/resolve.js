// Find a role or channel from what someone typed: a mention, an ID, or a name (case-insensitive).
const byText = (cache, text, mention) => {
    const raw = String(text ?? "").trim();
    if (!raw) return null;
    const id = raw.match(mention)?.[1] ?? (/^\d{17,20}$/.test(raw) ? raw : null);
    if (id) return cache.get(id) ?? null;
    const name = raw.replace(/^[@#]/, "").toLowerCase();
    return cache.find((x) => x.name?.toLowerCase() === name) ?? null;
};

const findRole = (guild, text) => byText(guild.roles.cache, text, /^<@&(\d{17,20})>$/);
const findChannel = (guild, text) => byText(guild.channels.cache, text, /^<#(\d{17,20})>$/);

// With the Server Members intent, discord.js keeps the member cache up to date after one full download,
// so each server is downloaded once (shared between overlapping commands) instead of on every command.
const memberDownloads = new Map(); // guild id -> Promise<boolean>
function ensureMembers(guild) {
    if (!memberDownloads.has(guild.id)) {
        memberDownloads.set(guild.id, guild.members.fetch().then(() => true, () => {
            memberDownloads.delete(guild.id); // try again next time
            return false;
        }));
    }
    return memberDownloads.get(guild.id);
}

module.exports = { findRole, findChannel, ensureMembers };
