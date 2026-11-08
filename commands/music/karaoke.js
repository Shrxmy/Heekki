const { musicEmbed } = require("../../lib/music/embed");

module.exports = {
    name: "karaoke",
    description: 'Changes the filter of the song to Karaoke.',
    aliases: ['instrumental'],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");

        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (channel.id !== player.voiceChannelId) return message.reply("Come join me in my voice channel first 🌙");

        if (!player.filterManager.filters.karaoke) await player.filterManager.toggleKaraoke();
        return message.channel.send({ embeds: [musicEmbed().setDescription("🎚️ **Karaoke** is on! Use `filteroff` to go back to the original sound.")] });
    }
}
