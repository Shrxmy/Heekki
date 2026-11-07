const { ApplicationCommandOptionType } = require("discord.js");

module.exports = {
    name: "volume",
    description: 'Changes the volume of the player.',
    aliases: ['vol'],
    options: [{ name: 'level', description: 'Volume from 1 to 100 (leave empty to see the current volume)', type: ApplicationCommandOptionType.Integer, min_value: 1, max_value: 100 }],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
  
        if (!player) return message.reply("There is no queue within the server.");
        if (!args.length) return message.reply(`The player volume is \`${player.volume}\`.`)
    
        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("You need to join a voice channel.");
        if (channel.id !== player.voiceChannelId) return message.reply("You're not in the same voice channel.");
    
        const volume = Number(args[0]);
        
        if (!volume || volume < 1 || volume > 100) return message.reply("You need to give me a volume between 1 and 100.");
    
        await player.setVolume(volume);
        return message.reply(`Set the volume to \`${volume}\`.`);
    }
}
