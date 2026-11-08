module.exports = {
    name: "pause",
    description: 'Pauses the current track.',
    aliases: [],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");
    
        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (channel.id !== player.voiceChannelId) return message.reply("Come join me in my voice channel first 🌙");
        if (player.paused) return message.reply("Already paused ⏸️");
    
        await player.pause();
        return message.reply("⏸️ Paused. Use `resume` when you're ready, Orbit.");
    }
};