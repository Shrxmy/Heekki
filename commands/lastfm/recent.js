const { ApplicationCommandOptionType } = require("discord.js");
const lastfm = require("../../lib/lastfm");
const { memberFor } = require("../../lib/loona");
const { musicEmbed, emoji } = require("../../lib/music/embed");

module.exports = {
    name: "recent",
    description: "Your last 10 scrobbles on Last.fm.",
    aliases: ['rc'],
    options: [{ name: 'user', description: 'Who (leave empty for yourself)', type: ApplicationCommandOptionType.User }],
    run: async (client, message, args) => {
        if (!lastfm.hasKey()) return message.reply(lastfm.NO_KEY);
        const { member, username, problem } = await lastfm.whoFrom(message, args);
        if (problem) return message.reply(lastfm.quiet(problem));

        let recent;
        try {
            recent = (await lastfm.call("user.getRecentTracks", { user: username, limit: "10" })).recenttracks;
        } catch {
            return message.reply("Last.fm didn't answer, try again in a bit 🌙");
        }
        // While something is playing, Last.fm sends it on top of the 10 finished ones.
        const tracks = [].concat(recent?.track ?? []).slice(0, 10);
        if (!tracks.length) return message.reply(lastfm.quiet(`**${lastfm.clean(member.displayName)}** hasn't scrobbled anything yet 🌙`));

        const rows = tracks.map((t) => {
            const when = t["@attr"]?.nowplaying === "true" ? "🎧 now" : t.date?.uts ? `<t:${Number(t.date.uts)}:R>` : "";
            return `${lastfm.link(t.name, t.url, 80)} by **${lastfm.clean(t.artist?.["#text"] ?? t.artist?.name, 60)}** · ${when}`;
        });
        const host = memberFor(username);
        const embed = musicEmbed(host)
            .setAuthor({ name: `${emoji(host)} ${member.displayName}'s recent scrobbles`.slice(0, 256), iconURL: member.displayAvatarURL?.() ?? undefined })
            .setDescription(rows.join("\n").slice(0, 4096))
            .setThumbnail(lastfm.imageUrl(tracks[0].image))
            .setFooter({ text: `🌙 ${lastfm.plural(recent["@attr"]?.total ?? 0, "scrobble")} in total · Last.fm · ${username}` });
        return message.reply({ embeds: [embed] });
    }
};
