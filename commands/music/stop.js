module.exports = {
    name: "stop",
    description: 'Stops the current song.',
    aliases: ['stp', 's'],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");
    
        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (channel.id !== player.voiceChannelId) return message.reply("Come join me in my voice channel first 🌙");
        
        await player.destroy();
        return message.reply("⏹️ Stopped the music and cleared the queue. See you soon, Orbit 🌙");
    }
};