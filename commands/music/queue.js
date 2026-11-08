const { ApplicationCommandOptionType } = require("discord.js");
const { musicEmbed, link, length, clock, djFor, emoji } = require("../../lib/music/embed");

const PER_PAGE = 10;

module.exports = {
    name: "queue",
    description: 'Shows the current queue of songs.',
    aliases: ['q'],
    options: [{ name: 'page', description: 'Page of the queue to show', type: ApplicationCommandOptionType.Integer, min_value: 1 }],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");

        const { current, tracks: all } = player.queue;
        const maxPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
        const page = Math.min(maxPages, Number.isInteger(Number(args[0])) && Number(args[0]) > 0 ? Number(args[0]) : 1);
        const start = (page - 1) * PER_PAGE;
        const tracks = all.slice(start, start + PER_PAGE);

        const dj = current && djFor(current);
        const lines = [];
        if (current) lines.push(`**${emoji(dj)} ${dj.name} is playing**\n${link(current)} · \`${length(current)}\``, "");
        lines.push("**Up next**");
        lines.push(tracks.length
            ? tracks.map((track, i) => `\`${start + i + 1}.\` ${link(track)} · \`${length(track)}\``).join("\n")
            : "Nothing up next. Add songs with `play`, Orbit 🌙");

        const total = all.reduce((sum, t) => sum + (t.info.isStream ? 0 : t.info.duration), 0);
        const embed = musicEmbed(dj || undefined)
            .setAuthor({ name: `🌙 ${message.guild.name}'s queue`, iconURL: message.guild.iconURL() ?? undefined })
            .setDescription(lines.join("\n").slice(0, 4096))
            .setFooter({ text: `Page ${page} of ${maxPages} · ${all.length} song${all.length === 1 ? "" : "s"} · ${clock(total)} total` });

        return message.reply({ embeds: [embed] });
    }
};
