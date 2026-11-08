const { ApplicationCommandOptionType } = require("discord.js");
const lastfm = require("../../lib/lastfm");
const { memberFor } = require("../../lib/loona");
const { musicEmbed, emoji } = require("../../lib/music/embed");

module.exports = {
    name: "fm",
    description: "Shows what you (or someone) are listening to on Last.fm right now.",
    aliases: ['lastfm', 'fmnp'],
    options: [{ name: 'user', description: 'Who (leave empty for yourself)', type: ApplicationCommandOptionType.User }],
    run: async (client, message, args) => {
        if (!lastfm.hasKey()) return message.reply(lastfm.NO_KEY);
        const { member, username, problem } = await lastfm.whoFrom(message, args);
        if (problem) return message.reply(lastfm.quiet(problem));

        let recent;
        try {
            recent = (await lastfm.call("user.getRecentTracks", { user: username, limit: "1" })).recenttracks;
        } catch {
            return message.reply("Last.fm didn't answer, try again in a bit 🌙");
        }
        const track = [].concat(recent?.track ?? [])[0];
        if (!track) return message.reply(lastfm.quiet(`**${lastfm.clean(member.displayName)}** hasn't scrobbled anything yet 🌙`));

        const artist = track.artist?.["#text"] ?? track.artist?.name ?? "Unknown artist";
        const album = track.album?.["#text"];
        // Their play count for this song is a nice extra; the card still works without it.
        const plays = await lastfm.call("track.getInfo", { artist, track: track.name, username, autocorrect: "1" })
            .then((d) => d.track?.userplaycount).catch(() => undefined);

        const host = memberFor(`${artist}${track.name}`);
        const live = track["@attr"]?.nowplaying === "true";
        const footer = [plays !== undefined && lastfm.plural(plays, "play"), recent["@attr"]?.total && `${lastfm.plural(recent["@attr"].total, "scrobble")} in total`];
        const embed = musicEmbed(host)
            .setAuthor({ name: `${emoji(host)} ${member.displayName} ${live ? "is listening to" : "last listened to"}`.slice(0, 256),
                iconURL: member.displayAvatarURL?.() ?? undefined })
            .setDescription(`**${lastfm.link(track.name, track.url, 200)}**\nby **${lastfm.clean(artist)}**${album ? ` · *${lastfm.clean(album)}*` : ""}`)
            .setThumbnail(lastfm.imageUrl(track.image))
            .setFooter({ text: `🌙 ${footer.filter(Boolean).join(" · ") || "Last.fm"}` });
        return message.reply({ embeds: [embed] });
    }
};
