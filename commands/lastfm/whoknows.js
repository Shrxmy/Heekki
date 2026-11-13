const { ApplicationCommandOptionType } = require("discord.js");
const lastfm = require("../../lib/lastfm");
const server = require("../../lib/lastfm/server");

module.exports = {
    name: "whoknows",
    description: "Who in this server listens to an artist the most on Last.fm (the top listener holds its crown).",
    aliases: ['wk'],
    options: [{ name: 'artist', description: 'Which artist (leave empty for what you are playing)', type: ApplicationCommandOptionType.String, max_length: 100 }],
    MAX_CHECKED: server.MAX_CHECKED,
    run: async (client, message, args) => {
        if (!lastfm.hasKey()) return message.reply(lastfm.NO_KEY);
        const subject = await server.subjectFrom(message, args, (t) => t.artist, "whoknows LOONA");
        if (subject.problem) return message.reply(subject.problem);

        let artist;
        try {
            artist = (await lastfm.call("artist.getInfo", { artist: subject.text, autocorrect: "1" })).artist;
        } catch (err) {
            return message.reply(lastfm.quiet(err.notFound ? `I couldn't find an artist called "${subject.text.slice(0, 100)}" on Last.fm 🌙` : "Last.fm didn't answer, try again in a bit 🌙"));
        }

        const ranking = await server.rankServer(message.guild, (username) =>
            lastfm.call("artist.getInfo", { artist: artist.name, username, autocorrect: "1" }).then((d) => d.artist?.stats?.userplaycount));
        if (!ranking.linked.size) return message.reply("Nobody here has linked their Last.fm yet. Be the first with `fmset <username>` 🌙");
        if (ranking.failed === ranking.counts.length) return message.reply("Last.fm didn't answer, try again in a bit 🌙");

        const crown = await server.updateCrown(message.guild.id, artist.name, ranking);
        const note = crown?.takenFrom
            ? `👑 **${server.displayName(message.guild, crown.userId)}** took the ${lastfm.clean(artist.name)} crown from ${server.displayName(message.guild, crown.takenFrom)}!`
            : null;
        return message.reply({ embeds: [server.rankingEmbed(message, { title: artist.name, url: artist.url, ranking, crownHolder: crown?.userId, note })] });
    }
};
