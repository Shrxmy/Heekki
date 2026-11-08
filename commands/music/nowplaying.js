const { trackEmbed, createBar } = require("../../lib/music/embed");

module.exports = {
    name: "nowplaying",
    description: 'Shows the current song being played.',
    aliases: ['np'],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");

        const { channel } = message.member.voice;
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (channel.id !== player.voiceChannelId) return message.reply("Come join me in my voice channel first 🌙");

        const current = player.queue.current;
        if (!current) return message.reply("Nothing's playing right now 🌙");

        const upNext = player.queue.tracks.length;
        const embed = trackEmbed(current, "is playing")
            .addFields(
                { name: "Progress", value: createBar(player) },
                { name: "Up next", value: upNext ? `${upNext} song${upNext === 1 ? "" : "s"}` : "Nothing", inline: true },
                { name: "Loop", value: { track: "This song", queue: "Whole queue" }[player.repeatMode] ?? "Off", inline: true },
                { name: "Volume", value: `${player.volume}%`, inline: true },
            );
        return message.channel.send({ embeds: [embed] });
    }
};
