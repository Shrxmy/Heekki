module.exports = {
    name: "resume",
    description: 'Resumes the current track.',
    aliases: [],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");
    
        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (channel.id !== player.voiceChannelId) return message.reply("Come join me in my voice channel first 🌙");
        if (!player.paused) return message.reply("The music isn't paused 🎶");
    
        await player.resume();
        return message.reply("▶️ And we're back, Orbit!");
    }
};