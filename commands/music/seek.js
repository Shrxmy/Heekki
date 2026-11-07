const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const { format, createBar } = require("./nowplaying");

module.exports = {
    name: "seek",
    description: 'Seeks the current playing music.',
    aliases: [],
    options: [{ name: 'seconds', description: 'Where to jump to, in seconds', type: ApplicationCommandOptionType.Integer, min_value: 0, required: true }],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("There is no queue within the server.");

        const { channel } = message.member.voice;
        if (!channel) return message.reply("You need to join a voice channel.");
        if (channel.id !== player.voiceChannelId) return message.reply("You're not in the same voice channel.");

        const current = player.queue.current;
        if (!current) return message.reply("There is no music playing.");
        if (!current.info.isSeekable) return message.reply("This track can't be seeked.");

        const seconds = Number(args[0]);
        if (!args.length || !Number.isFinite(seconds) || seconds < 0 || seconds >= current.info.duration / 1000) {
            const fail = new EmbedBuilder()
                .setColor('Red')
                .setTitle(`You may seek from \`0\` - \`${Math.floor(current.info.duration / 1000) - 1}\` seconds`)
            return message.channel.send({embeds: [fail]});
        }

        await player.seek(seconds * 1000);
        const success = new EmbedBuilder()
            .setTitle(`Seeked song to: ${format(seconds * 1000)}`)
            .addFields({ name: `Progress: `, value: createBar(player, 15) })
            .setColor('Green')
        return message.channel.send({embeds: [success]});
    }
};
