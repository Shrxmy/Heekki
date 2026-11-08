const { ApplicationCommandOptionType } = require("discord.js");
const levels = {
    0: 0.0,
    1: 0.50,
    2: 1.0,
    3: 2.0,
};

module.exports = {
    name: "bassboost",
    description: 'Bassboost\'s the current song with a given level.',
    aliases: ['bb'],
    options: [{ name: 'level', description: 'Bassboost level (0 turns it off)', type: ApplicationCommandOptionType.String, choices: ['0', '1', '2', '3'].map((v) => ({ name: v, value: v })) }],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");
    
        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (channel.id !== player.voiceChannelId) return message.reply("Come join me in my voice channel first 🌙");
    
        let level = "0";
        if (args.length && args[0].toLowerCase() in levels) level = args[0].toLowerCase();
    
        const bands = new Array(3)
            .fill(null)
            .map((_, i) =>
            ({ band: i, gain: levels[level] })
            );
    
        await player.filterManager.setEQ(bands);
    
        return message.reply(level === "0" ? "🔈 Bass boost is off." : `🔊 Bass boost set to level ${level}!`);
    }
};