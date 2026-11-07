module.exports = {
    name: "pause",
    description: 'Pauses the current track.',
    aliases: [],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("There is no queue within the server.");
    
        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("You need to join a voice channel.");
        if (channel.id !== player.voiceChannelId) return message.reply("You're not in the same voice channel.");
        if (player.paused) return message.reply("The player is already paused.");
    
        await player.pause();
        return message.reply("Paused the queue.");
    }
};