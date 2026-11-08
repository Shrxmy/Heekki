const { ApplicationCommandOptionType } = require("discord.js");
const lastfm = require("../../lib/lastfm");
const { memberFor } = require("../../lib/loona");
const { musicEmbed, emoji } = require("../../lib/music/embed");

// type -> Last.fm method, where the list sits in the reply, and how one row reads.
const TYPES = {
    artists: { method: "user.getTopArtists", list: (d) => d.topartists?.artist, row: (a) => lastfm.link(a.name, a.url) },
    tracks: { method: "user.getTopTracks", list: (d) => d.toptracks?.track, row: (t) => `${lastfm.link(t.name, t.url)} by ${lastfm.clean(t.artist?.name)}` },
    albums: { method: "user.getTopAlbums", list: (d) => d.topalbums?.album, row: (a) => `${lastfm.link(a.name, a.url)} by ${lastfm.clean(a.artist?.name)}` },
};

module.exports = {
    name: "fmtop",
    description: "Your top 10 artists, tracks or albums on Last.fm for a time period.",
    aliases: ['fmt'],
    options: [
        { name: 'type', description: 'What to rank (default: artists)', type: ApplicationCommandOptionType.String, choices: Object.keys(TYPES).map((t) => ({ name: t, value: t })) },
        { name: 'period', description: 'Time period (default: week)', type: ApplicationCommandOptionType.String, choices: lastfm.PERIOD_CHOICES },
        { name: 'user', description: 'Who (leave empty for yourself)', type: ApplicationCommandOptionType.User },
    ],
    run: async (client, message, args) => {
        if (!lastfm.hasKey()) return message.reply(lastfm.NO_KEY);
        const { member, username, problem } = await lastfm.whoFrom(message, args);
        if (problem) return message.reply(lastfm.quiet(problem));
        const typeName = args.map((a) => a.toLowerCase()).find((a) => Object.hasOwn(TYPES, a)) ?? "artists";
        const type = TYPES[typeName];
        const period = lastfm.periodFrom(args);

        let items;
        try {
            items = [].concat(type.list(await lastfm.call(type.method, { user: username, period: period.api, limit: "10" })) ?? []);
        } catch {
            return message.reply("Last.fm didn't answer, try again in a bit 🌙");
        }

        const host = memberFor(username);
        const rows = items.slice(0, 10).map((item, i) => `\`${i + 1}.\` ${type.row(item)} · ${lastfm.plural(item.playcount ?? 0, "play")}`);
        const embed = musicEmbed(host)
            .setAuthor({ name: `${emoji(host)} ${member.displayName}'s top ${typeName}, ${period.label}`.slice(0, 256), iconURL: member.displayAvatarURL?.() ?? undefined })
            .setDescription(rows.join("\n").slice(0, 4096) || `Nothing scrobbled ${period.label} yet 🌙`)
            .setFooter({ text: `🌙 Last.fm · ${username}` });
        return message.reply({ embeds: [embed] });
    }
};
