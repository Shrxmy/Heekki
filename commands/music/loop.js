const { ApplicationCommandOptionType } = require("discord.js");

module.exports = {
    name: "loop",
    description: 'Loops the current song.',
    aliases: ['repeat'],
    options: [{ name: 'mode', description: 'Repeat the current track (default) or the whole queue', type: ApplicationCommandOptionType.String, choices: [{ name: 'track', value: 'track' }, { name: 'queue', value: 'queue' }] }],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");
    
        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (channel.id !== player.voiceChannelId) return message.reply("Come join me in my voice channel first 🌙");
        
        if (args.length && /queue/i.test(args[0])) {
            await player.setRepeatMode(player.repeatMode === "queue" ? "off" : "queue");
            return message.reply(player.repeatMode === "queue" ? "🔁 Looping the whole queue, Orbit!" : "🔁 Queue loop is off.");
        }
    
        await player.setRepeatMode(player.repeatMode === "track" ? "off" : "track");
        return message.reply(player.repeatMode === "track" ? "🔂 Looping this song, Orbit!" : "🔂 Song loop is off.");
    }   
};