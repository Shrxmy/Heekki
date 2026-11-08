const { musicEmbed } = require("../../lib/music/embed");

module.exports = {
    name: "8d",
    description: 'Changes the filter of the song to 8D.',
    aliases: ['8D'],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");

        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (channel.id !== player.voiceChannelId) return message.reply("Come join me in my voice channel first 🌙");

        if (!player.filterManager.filters.rotation) await player.filterManager.toggleRotation(0.2);
        return message.channel.send({ embeds: [musicEmbed().setDescription("🎚️ **8D** is on! Use `filteroff` to go back to the original sound.")] });
    }
}
