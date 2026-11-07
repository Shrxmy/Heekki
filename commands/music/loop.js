const { ApplicationCommandOptionType } = require("discord.js");

module.exports = {
    name: "loop",
    description: 'Loops the current song.',
    aliases: ['repeat'],
    options: [{ name: 'mode', description: 'Repeat the current track (default) or the whole queue', type: ApplicationCommandOptionType.String, choices: [{ name: 'track', value: 'track' }, { name: 'queue', value: 'queue' }] }],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("There is no queue within the server.");
    
        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("You need to join a voice channel.");
        if (channel.id !== player.voiceChannelId) return message.reply("You're not in the same voice channel.");
        
        if (args.length && /queue/i.test(args[0])) {
            await player.setRepeatMode(player.repeatMode === "queue" ? "off" : "queue");
            const queueRepeat = player.repeatMode === "queue" ? "Enabled" : "Disabled";
            return message.reply(`I have ${queueRepeat} queue repeat.`);
        }
    
        await player.setRepeatMode(player.repeatMode === "track" ? "off" : "track");
        const trackRepeat = player.repeatMode === "track" ? "enabled" : "disabled";
        return message.reply(`I have ${trackRepeat} track repeat.`);
    }   
};