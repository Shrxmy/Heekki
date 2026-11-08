const { ApplicationCommandOptionType } = require("discord.js");

module.exports = {
    name: "volume",
    description: 'Changes the volume of the player.',
    aliases: ['vol'],
    options: [{ name: 'level', description: 'Volume from 1 to 100 (leave empty to see the current volume)', type: ApplicationCommandOptionType.Integer, min_value: 1, max_value: 100 }],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
  
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");
        if (!args.length) return message.reply(`🔉 The volume is at ${player.volume}%.`)
    
        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (channel.id !== player.voiceChannelId) return message.reply("Come join me in my voice channel first 🌙");
    
        const volume = Number(args[0]);
        
        if (!volume || volume < 1 || volume > 100) return message.reply("Pick a volume from 1 to 100, Orbit.");
    
        await player.setVolume(volume);
        return message.reply(`🔊 Volume set to ${volume}%.`);
    }
}
