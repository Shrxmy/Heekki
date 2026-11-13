const { ApplicationCommandOptionType } = require("discord.js");
const lastfm = require("../../lib/lastfm");
const server = require("../../lib/lastfm/server");
const { getLastfm } = require("../../lib/db");
const { bio } = require("./artist");
const { memberFor } = require("../../lib/loona");
const { musicEmbed, emoji } = require("../../lib/music/embed");

module.exports = {
    name: "album",
    description: "Info about an album on Last.fm, with your plays and your rank in this server.",
    aliases: ['ab'],
    options: [{ name: 'album', description: 'Artist - Album (leave empty for what you are playing)', type: ApplicationCommandOptionType.String, max_length: 200 }],
    run: async (client, message, args) => {
        if (!lastfm.hasKey()) return message.reply(lastfm.NO_KEY);
        const subject = await server.subjectFrom(message, args, (t) => (t.album ? `${t.artist} - ${t.album}` : ""), "album LOONA - [12:00]");
        if (subject.problem) return message.reply(subject.problem);
        const pair = lastfm.splitPair(subject.text);
        if (!pair) return message.reply("Write it as `album Artist - Album`, like `album LOONA - [12:00]` 🌙");

        let album;
        try {
            album = (await lastfm.call("album.getInfo", { artist: pair[0], album: pair[1], autocorrect: "1" })).album;
        } catch (err) {
            return message.reply(lastfm.quiet(err.notFound ? `I couldn't find "${subject.text.slice(0, 100)}" on Last.fm 🌙` : "Last.fm didn't answer, try again in a bit 🌙"));
        }
        const artist = album.artist ?? pair[0];
        const ranking = await server.rankServer(message.guild, (username) =>
            lastfm.call("album.getInfo", { artist, album: album.name, username, autocorrect: "1" }).then((d) => d.album?.userplaycount));

        const me = message.author.id;
        const mine = ranking.counts.find((c) => c.id === me);
        const rank = ranking.listeners.findIndex((c) => c.id === me);
        const tracks = [].concat(album.tracks?.track ?? []).length;
        const fields = [];
        if (await getLastfm(me)) {
            fields.push({ name: "Your plays", value: mine?.failed || !mine ? "Couldn't load" : lastfm.plural(mine.plays, "play"), inline: true });
            fields.push({ name: "Server rank", value: rank >= 0 ? `#${rank + 1} of ${ranking.listeners.length}` : "Not ranked yet", inline: true });
        }
        fields.push(
            { name: "Listeners", value: Number(album.listeners ?? 0).toLocaleString("en-US"), inline: true },
            { name: "Scrobbles", value: Number(album.playcount ?? 0).toLocaleString("en-US"), inline: true },
        );
        if (tracks) fields.push({ name: "Tracks", value: String(tracks), inline: true });

        const host = memberFor(album.name);
        const embed = musicEmbed(host)
            .setAuthor({ name: `${emoji(host)} Album by ${artist}`.slice(0, 256) })
            .setTitle(album.name.slice(0, 256))
            .setURL(lastfm.pageUrl(album.url))
            .setThumbnail(lastfm.imageUrl(album.image))
            .setDescription(lastfm.clean(bio(album.wiki?.summary), 400) || null)
            .addFields(fields)
            .setFooter({ text: "🌙 Last.fm" });
        return message.reply({ embeds: [embed] });
    }
};
