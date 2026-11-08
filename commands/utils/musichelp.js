const { getPrefix } = require("../../lib/db");
const { musicEmbed } = require("../../lib/music/embed");

module.exports = {
    name: "musichelp",
    description: 'Provides a guide for music settings.',
    aliases: ['musich'],
    run: async (client, message, args) => {
        const p = getPrefix(message.guild.id);
        const embed = musicEmbed()
            .setTitle("🌙 Music guide for Orbit")
            .setDescription("Join a voice channel first, then:")
            .addFields(
                { name: "Search for a song", value: `\`${p}play <song name>\`\n${client.user.username} shows the top results. Type the number of the one you want.` },
                { name: "Play a link", value: `\`${p}play <YouTube or Spotify link>\`\nSongs and playlists are added to the queue straight away.` },
                { name: "Control playback", value: `\`${p}pause\` \`${p}resume\` \`${p}skip\` \`${p}stop\` \`${p}seek\` \`${p}volume\` \`${p}loop\`` },
                { name: "See what's playing", value: `\`${p}nowplaying\` \`${p}queue\`` },
                { name: "Filters", value: `\`${p}8d\` \`${p}karaoke\` \`${p}nightcore\` \`${p}treblebass\` \`${p}bassboost\`\nTurn them off with \`${p}filteroff\`.` },
            );

        return message.channel.send({ embeds: [embed] });
    }
};
