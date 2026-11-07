const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");

module.exports = {
    name: "queue",
    description: 'Shows the current queue of songs.',
    aliases: ['q'],
    options: [{ name: 'page', description: 'Page of the queue to show', type: ApplicationCommandOptionType.Integer, min_value: 1 }],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("There is no queue within the server.");

        const queue = player.queue;
        const embed = new EmbedBuilder()
        .setAuthor({ name: `Queue for ${message.guild.name}` });

        // change for the amount of tracks per page
        const multiple = 10;
        const page = args.length && Number(args[0]) ? Number(args[0]) : 1;

        const end = page * multiple;
        const start = end - multiple;

        const tracks = queue.tracks.slice(start, end);

        if (queue.current) embed.addFields({ name: "Current", value: `[${queue.current.info.title}](${queue.current.info.uri})` });

        if (!tracks.length) embed.setDescription(`No tracks in ${page > 1 ? `page ${page}` : "the queue"}.`);
        else embed.setDescription(tracks.map((track, i) => `${start + (++i)} - [${track.info.title}](${track.info.uri})`).join("\n"));

        const maxPages = Math.max(1, Math.ceil(queue.tracks.length / multiple));

        embed.setFooter({ text: `Page ${page > maxPages ? maxPages : page} of ${maxPages}` });

        return message.reply({embeds: [embed]});
    }
};
