// Photocard drops: after a burst of chat in a server's drop channel, a card falls in and the first `catch` wins it.
const { AttachmentBuilder, EmbedBuilder } = require("discord.js");
const { randomInt } = require("node:crypto");
const pc = require("./photocards");
const db = require("../db");

const MIN_MESSAGES = 15, MAX_MESSAGES = 40; // a drop comes after this many messages (picked at random each time)
const GAP_MS = 10 * 60_000; // and at least this long after the last one, so spamming can't farm cards
const CATCH_MS = 60_000;
const CACHE_MS = 5 * 60_000; // how long a server's drop channel is remembered before checking the database again

// shortcut: lastDropAt lives in memory, so a restart allows the next drop sooner than 10 minutes; store it if that matters.
const servers = new Map(); // guild id -> { channelId, checkedAt, version, count, needed, lastDropAt, dropping }

function state(guildId) {
    if (!servers.has(guildId)) servers.set(guildId, { channelId: null, checkedAt: 0, version: 0, count: 0, needed: randomInt(MIN_MESSAGES, MAX_MESSAGES + 1), lastDropAt: 0, dropping: false });
    return servers.get(guildId);
}

/** Forget the cached channel (after set-drop-channel). */
const forget = (guildId) => { const s = state(guildId); s.checkedAt = 0; s.count = 0; s.version++; };

/** Drops a card in `channel` and gives it to the first person who types `catch`. Returns the winner's id or null. */
async function drop(channel, guildId) {
    const s = state(guildId);
    if (s.dropping) return null; // one at a time, even for test drops: one "catch" must never win two cards
    s.dropping = true;
    s.lastDropAt = Date.now();
    try {
        const c = pc.roll(Math.random, pc.validGroups(await db.getCardGroups(guildId))); // the server's card groups
        const embed = new EmbedBuilder().setColor(c.member.color.hex)
            .setTitle("🌙 A photocard fell from the sky!")
            .setDescription(`**${pc.fullName(c.member)} · ${c.rarity.label}**\nFirst to type \`catch\` gets it.`)
            .setImage("attachment://photocard.png").setFooter({ text: pc.credit(c) });
        // Ping whoever wishlisted this card (and doesn't have it); a database hiccup just means no pings.
        const wishers = (await db.wishersFor(guildId, c.id).catch(() => [])).slice(0, 20);
        await channel.send({ content: wishers.length ? `💫 On the wishlist of ${wishers.map((id) => `<@${id}>`).join(" ")}` : undefined,
            embeds: [embed], files: [new AttachmentBuilder(await pc.renderPhotocard(c), { name: "photocard.png" })], allowedMentions: { users: wishers } });
        const caught = await channel.awaitMessages({ filter: (m) => !m.author.bot && m.content.trim().toLowerCase() === "catch", max: 1, time: CATCH_MS })
            .then((got) => got.first()).catch(() => null);
        if (!caught) {
            await channel.send(`The ${pc.fullName(c.member)} card floated away… Next time, Orbit 🌙`);
            return null;
        }
        const copies = await db.giftPhotocard(guildId, caught.author.id, c.id);
        await channel.send({ content: `🎉 <@${caught.author.id}> caught **${pc.fullName(c.member)} · ${c.rarity.label}**!${copies > 1 ? ` (you have ${copies} now)` : ""}`, allowedMentions: { users: [caught.author.id] } });
        return caught.author.id;
    } finally {
        s.dropping = false;
        s.count = 0;
        s.needed = randomInt(MIN_MESSAGES, MAX_MESSAGES + 1);
    }
}

/** Counts a chat message; drops a card when enough have been sent in the drop channel. Never throws. */
async function onMessage(message) {
    try {
        if (message.author.bot || !message.guild) return;
        const s = state(message.guild.id);
        if (Date.now() - s.checkedAt > CACHE_MS) {
            const version = s.version;
            const channelId = await db.getDropChannel(message.guild.id);
            if (version !== s.version) return; // set-drop-channel changed it meanwhile: this answer may be stale
            s.channelId = channelId;
            s.checkedAt = Date.now();
        }
        if (!s.channelId || message.channel.id !== s.channelId || s.dropping) return;
        if (++s.count < s.needed || Date.now() - s.lastDropAt < GAP_MS) return;
        await drop(message.channel, message.guild.id);
    } catch (err) {
        console.error(`Photocard drop failed in guild ${message.guild?.id}: ${err.message}`);
    }
}

module.exports = { onMessage, drop, forget, servers, MIN_MESSAGES, MAX_MESSAGES, GAP_MS };
