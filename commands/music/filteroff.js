const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "filteroff",
    description: 'Removes the filters provided.',
    aliases: ['removefilter'],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("There is no queue within the server.");

        const { channel } = message.member.voice;
        
        if (!channel) return message.reply("You need to join a voice channel.");
        if (channel.id !== player.voiceChannelId) return message.reply("You're not in the same voice channel.");

        await player.filterManager.resetFilters();
        await player.filterManager.clearEQ();
        const embed = new EmbedBuilder()
            .setTitle('Filter')
            .setColor('#95E8A3')
            .setDescription(`I'm **Removing** the Filter to the Music, Please wait.`)

        message.channel.send({ embeds: [embed]});
    }
}
