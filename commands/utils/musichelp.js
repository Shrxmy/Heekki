const { EmbedBuilder } = require("discord.js");
const { getPrefix } = require("../../db");

module.exports = {
    name: "musichelp",
    description: 'Provides a guide for music settings.',
    aliases: ['musich'],
    run: async (client, message, args) => {
        const prefix = getPrefix(message.guild.id);
        const embed = new EmbedBuilder()
        .setTitle('Music Help')
        .setColor('Purple')
        .addFields(
        {
            name: 'Queueing Music',
            value: `To queue a query, use ${prefix}play <your choice>, after that Minty would ask which would you like to play, choose a number from the list and the bot will play.`
        },
        {
            name: 'Queueing Music Links',
            value: `This is more simplier as this instantly queue's your song. Do ${prefix}play <https://yourspotify/youtubelink>.`
        },
        {
            name: 'Filtering',
            value: `There are different variety's of filters (${prefix}8d, ${prefix}karaoke, ${prefix}nightcore, ${prefix}treblebass, ${prefix}bassboost). To remove them use ${prefix}filteroff.`
        }
        )

        message.channel.send ({embeds: [embed]})
    } 
}
