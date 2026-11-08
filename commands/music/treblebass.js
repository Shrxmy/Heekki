const { musicEmbed } = require("../../lib/music/embed");
// Same EQ curve erela.js-filters used, with gains clamped to Lavalink's -0.25..1.0 range.
const trebleBass = [0.6, 0.67, 0.67, 0, -0.25, 0.15, -0.25, 0.23, 0.35, 0.45, 0.55, 0.6, 0.55, 0]
    .map((gain, band) => ({ band, gain }));

module.exports = {
    name: "treblebass",
    description: 'Changes the filter of the song to treblebass.',
    aliases: [],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");

        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (channel.id !== player.voiceChannelId) return message.reply("Come join me in my voice channel first 🌙");

        await player.filterManager.setEQ(trebleBass);
        return message.channel.send({ embeds: [musicEmbed().setDescription("🎚️ **Treble bass** is on! Use `filteroff` to go back to the original sound.")] });
    }
}
