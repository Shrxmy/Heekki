module.exports = {
    name: "stop",
    description: 'Stops the current song.',
    aliases: ['stp', 's'],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("There is no queue within the server.");
    
        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("You need to join a voice channel.");
        if (channel.id !== player.voiceChannelId) return message.reply("You're not in the same voice channel.");
        
        await player.destroy();
        return message.reply("Stopped the queue.");
    }
};