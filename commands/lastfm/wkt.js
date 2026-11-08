const { ApplicationCommandOptionType } = require("discord.js");
const lastfm = require("../../lib/lastfm");
const server = require("../../lib/lastfm/server");

module.exports = {
    name: "wkt",
    description: "Who in this server listens to a song the most on Last.fm.",
    aliases: ['whoknowstrack'],
    options: [{ name: 'track', description: 'Artist - Track (leave empty for what you are playing)', type: ApplicationCommandOptionType.String, max_length: 200 }],
    run: async (client, message, args) => {
        if (!lastfm.hasKey()) return message.reply(lastfm.NO_KEY);
        const subject = await server.subjectFrom(message, args, (t) => `${t.artist} - ${t.name}`, "wkt LOONA - Butterfly");
        if (subject.problem) return message.reply(subject.problem);
        const pair = lastfm.splitPair(subject.text);
        if (!pair) return message.reply("Write it as `wkt Artist - Track`, like `wkt LOONA - Butterfly` 🌙");

        let track;
        try {
            track = (await lastfm.call("track.getInfo", { artist: pair[0], track: pair[1], autocorrect: "1" })).track;
        } catch (err) {
            return message.reply(lastfm.quiet(err.notFound ? `I couldn't find "${subject.text.slice(0, 100)}" on Last.fm 🌙` : "Last.fm didn't answer, try again in a bit 🌙"));
        }
        const artist = track.artist?.name ?? pair[0];

        const ranking = await server.rankServer(message.guild, (username) =>
            lastfm.call("track.getInfo", { artist, track: track.name, username, autocorrect: "1" }).then((d) => d.track?.userplaycount));
        if (!ranking.linked.size) return message.reply("Nobody here has linked their Last.fm yet. Be the first with `fmset <username>` 🌙");
        if (ranking.failed === ranking.counts.length) return message.reply("Last.fm didn't answer, try again in a bit 🌙");
        return message.reply({ embeds: [server.rankingEmbed(message, { title: `${track.name} by ${artist}`, url: track.url, ranking })] });
    }
};
