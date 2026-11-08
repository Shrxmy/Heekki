const { ApplicationCommandOptionType } = require("discord.js");
const { musicEmbed, createBar, clock, djFor } = require("../../lib/music/embed");

module.exports = {
    name: "seek",
    description: 'Seeks the current playing music.',
    aliases: [],
    options: [{ name: 'seconds', description: 'Where to jump to, in seconds', type: ApplicationCommandOptionType.Integer, min_value: 0, required: true }],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("Nothing's playing yet, Orbit. Start the music with `play` 🌙");

        const { channel } = message.member.voice;
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (channel.id !== player.voiceChannelId) return message.reply("Come join me in my voice channel first 🌙");

        const current = player.queue.current;
        if (!current) return message.reply("Nothing's playing right now 🌙");
        if (!current.info.isSeekable) return message.reply("You can't jump around in this one (it might be a live stream).");

        const seconds = Number(args[0]);
        if (!args.length || !Number.isFinite(seconds) || seconds < 0 || seconds >= current.info.duration / 1000)
            return message.reply(`Pick a spot from 0 to ${Math.floor(current.info.duration / 1000) - 1} seconds.`);

        await player.seek(seconds * 1000);
        const success = musicEmbed(djFor(current))
            .setAuthor({ name: `⏩ Jumped to ${clock(seconds * 1000)}` })
            .setDescription(createBar(player));
        return message.channel.send({embeds: [success]});
    }
};
