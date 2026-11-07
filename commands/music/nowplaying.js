const { Message, EmbedBuilder } = require("discord.js");

function format(millis) {
    const h = Math.floor(millis / 3600000),
        m = Math.floor(millis / 60000) % 60,
        s = Math.floor((millis % 60000) / 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return (h < 1 ? "" : pad(h) + ":") + pad(m) + ":" + pad(s) + " | " + Math.floor(millis / 1000) + " Seconds";
}

function createBar(player, size = 12) {
    const track = player.queue.current;
    if (!track) return `**[🔘${"▬".repeat(size - 1)}]**\n**00:00:00 / 00:00:00**`;
    const time = (ms) => new Date(ms).toISOString().substr(11, 8);
    if (track.info.isStream) return `**| ${"▬".repeat(size)} |**\n**${time(player.position)} /  ◉ LIVE**`;
    const done = Math.min(size, Math.round(size * (player.position / track.info.duration)));
    return `**| ${"🔘".repeat(done)}${"▬".repeat(size - done)} |**\n**${time(player.position)} / ${time(track.info.duration)}**`;
}

module.exports = {
    name: "nowplaying",
    description: 'Shows the current song being played.',
    aliases: ['np'],
    format,
    createBar,
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("There is no queue within the server.");

        const { channel } = message.member.voice;
        if (!channel) return message.reply("You need to join a voice channel.");
        if (channel.id !== player.voiceChannelId) return message.reply("You're not in the same voice channel.");

        const current = player.queue.current;
        if (!current) {
            const none = new EmbedBuilder()
                .setColor('Red')
                .setTitle(`There is nothing playing`)
            return message.channel.send({ embeds: [none]});
        }

        //Send Now playing Message
        const result = new EmbedBuilder()
            .setAuthor({ name: `Now Playing:`, iconURL: client.user.displayAvatarURL() })
            .setThumbnail(current.info.artworkUrl)
            .setURL(current.info.uri)
            .setColor('#95E8A3')
            .setTitle(`**${current.info.title}** 🎶`)
            .addFields(
                { name: `Duration: `, value: current.info.isStream ? '`LIVE`' : `\`${format(current.info.duration)}\``, inline: true },
                { name: `Song By: `, value: `\`${current.info.author}\`` },
                { name: `Queue length: `, value: `\`${player.queue.tracks.length} Songs\`` },
                { name: `Progress: `, value: createBar(player) },
            )
            .setTimestamp()
        if (current.requester) result.setFooter({ text: `Requested by: ${current.requester.tag}`, iconURL: current.requester.displayAvatarURL() })

        return message.channel.send({embeds: [result]});
    }
};
