const { ApplicationCommandOptionType } = require("discord.js");
const lastfm = require("../../lib/lastfm");
const server = require("../../lib/lastfm/server");

module.exports = {
    name: "wka",
    description: "Who in this server listens to an album the most on Last.fm.",
    aliases: ['whoknowsalbum'],
    options: [{ name: 'album', description: 'Artist - Album (leave empty for what you are playing)', type: ApplicationCommandOptionType.String, max_length: 200 }],
    run: async (client, message, args) => {
        if (!lastfm.hasKey()) return message.reply(lastfm.NO_KEY);
        const subject = await server.subjectFrom(message, args, (t) => (t.album ? `${t.artist} - ${t.album}` : ""), "wka LOONA - [12:00]");
        if (subject.problem) return message.reply(subject.problem);
        const pair = lastfm.splitPair(subject.text);
        if (!pair) return message.reply("Write it as `wka Artist - Album`, like `wka LOONA - [12:00]` 🌙");

        let album;
        try {
            album = (await lastfm.call("album.getInfo", { artist: pair[0], album: pair[1], autocorrect: "1" })).album;
        } catch (err) {
            return message.reply(lastfm.quiet(err.notFound ? `I couldn't find "${subject.text.slice(0, 100)}" on Last.fm 🌙` : "Last.fm didn't answer, try again in a bit 🌙"));
        }
        const artist = album.artist ?? pair[0];

        const ranking = await server.rankServer(message.guild, (username) =>
            lastfm.call("album.getInfo", { artist, album: album.name, username, autocorrect: "1" }).then((d) => d.album?.userplaycount));
        if (!ranking.linked.size) return message.reply("Nobody here has linked their Last.fm yet. Be the first with `fmset <username>` 🌙");
        if (ranking.failed === ranking.counts.length) return message.reply("Last.fm didn't answer, try again in a bit 🌙");
        const embed = server.rankingEmbed(message, { title: `${album.name} by ${artist}`, url: album.url, ranking }).setThumbnail(lastfm.imageUrl(album.image));
        return message.reply({ embeds: [embed] });
    }
};
