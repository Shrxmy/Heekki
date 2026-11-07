const { EmbedBuilder } = require("discord.js");
// Same EQ curve erela.js-filters used, with gains clamped to Lavalink's -0.25..1.0 range.
const trebleBass = [0.6, 0.67, 0.67, 0, -0.25, 0.15, -0.25, 0.23, 0.35, 0.45, 0.55, 0.6, 0.55, 0]
    .map((gain, band) => ({ band, gain }));

module.exports = {
    name: "treblebass",
    description: 'Changes the filter of the song to treblebass.',
    aliases: [],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("There is no queue within the server.");

        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("You need to join a voice channel.");
        if (channel.id !== player.voiceChannelId) return message.reply("You're not in the same voice channel.");

        await player.filterManager.setEQ(trebleBass);
        const embed = new EmbedBuilder()
            .setTitle('Adding Filter')
            .setColor('#95E8A3')
            .setDescription(`I'm **Adding** the Filter to the Music, Please wait.`)

        message.channel.send({ embeds: [embed]});
    }
}
