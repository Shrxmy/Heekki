const { musicEmbed } = require("../../lib/music/embed");

module.exports = {
    name: "filteroff",
    description: 'Removes the filters provided.',
    aliases: ['removefilter'],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");

        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (channel.id !== player.voiceChannelId) return message.reply("Come join me in my voice channel first 🌙");

        await player.filterManager.resetFilters();
        await player.filterManager.clearEQ();
        return message.channel.send({ embeds: [musicEmbed().setDescription("🎚️ Filters off, back to the original sound 🌙")] });
    }
}
