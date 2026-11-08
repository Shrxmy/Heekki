const { EmbedBuilder, escapeMarkdown } = require("discord.js");
const { members, memberFor } = require("../loona");

const emoji = (member) => member.animal.split(" ")[0];

/** The LOONA member hosting a song: picked from the song itself, so "now playing" and -np always agree. */
const djFor = (track) => memberFor(track.info.identifier ?? track.info.uri ?? track.info.title);
const anyMember = () => members[Math.floor(Math.random() * members.length)];

/** 3:05, or 1:02:05 for long tracks. */
function clock(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600), m = Math.floor(total / 60) % 60, s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const length = (track) => (track.info.isStream ? "LIVE" : clock(track.info.duration));

/** [Title](link): titles are outside data, so markdown in them is shown as-is. */
const link = (track) => `[${escapeMarkdown(track.info.title.slice(0, 200))}](${track.info.uri})`;

/** `1:30` ▬▬▬▬🔘▬▬▬▬ `3:00` */
function createBar(player, size = 14) {
    const track = player.queue.current;
    if (!track) return `\`0:00\` 🔘${"▬".repeat(size - 1)} \`0:00\``;
    if (track.info.isStream) return `\`${clock(player.position)}\` ${"▬".repeat(size)} \`🔴 LIVE\``;
    const knob = Math.min(size - 1, Math.floor(size * (player.position / track.info.duration)));
    return `\`${clock(player.position)}\` ${"▬".repeat(knob)}🔘${"▬".repeat(size - 1 - knob)} \`${clock(track.info.duration)}\``;
}

/** A music embed in a member's colour (a random member unless one is given). */
const musicEmbed = (member = anyMember()) => new EmbedBuilder().setColor(member.color.hex);

/** The track card, hosted by the song's member: "🐰 HeeJin is playing", linked title, artist and length, cover art, who asked for it. */
function trackEmbed(track, action) {
    const dj = djFor(track);
    const embed = musicEmbed(dj)
        .setAuthor({ name: `${emoji(dj)} ${dj.name} ${action}` })
        .setDescription(`**${link(track)}**\n${escapeMarkdown(track.info.author ?? "")} · \`${length(track)}\``)
        .setThumbnail(track.info.artworkUrl ?? null);
    const by = track.requester;
    if (by?.username) embed.setFooter({ text: `For ${by.globalName ?? by.username}`, iconURL: by.displayAvatarURL?.() });
    return embed;
}

module.exports = { emoji, djFor, clock, length, link, createBar, musicEmbed, trackEmbed };
