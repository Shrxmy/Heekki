const { ApplicationCommandOptionType } = require("discord.js");

// Track titles are untrusted: never let one ping anybody.
const safe = (content) => ({ content, allowedMentions: { parse: [], repliedUser: true } });

module.exports = {
    name: "skip",
    description: 'Skips the current track, or a chosen song in the queue.',
    aliases: ['skp', 'skipper'],
    options: [{ name: 'number', description: 'Song number from the queue command (leave empty to skip the current song)', type: ApplicationCommandOptionType.Integer, min_value: 1 }],
    run: async (client, message, args) => {
        const player = client.lavalink.getPlayer(message.guild.id);
        if (!player) return message.reply("There is no queue within the server.");

        const { channel } = message.member.voice;
        if (!channel) return message.reply("You need to join a voice channel.");
        if (channel.id !== player.voiceChannelId) return message.reply("You're not in the same voice channel.");

        // skip <number>: take that song out of the upcoming queue (numbers match the queue command)
        if (args.length) {
            const number = Number(args[0]);
            const upcoming = player.queue.tracks.length;
            if (!upcoming) return message.reply("There are no upcoming songs to skip.");
            if (!Number.isInteger(number) || number < 1 || number > upcoming)
                return message.reply(`Pick a song number from 1 to ${upcoming} (see the queue command).`);
            const removed = await player.queue.splice(number - 1, 1); // a single removed track comes back un-wrapped
            return message.reply(safe(`Removed #${number} ${removed.info.title} from the queue.`));
        }

        if (!player.queue.current) return message.reply("There is no music playing.")

        const { title } = player.queue.current.info;

        await player.skip(0, false); // on the last track this just ends it, like the old stop()
        return message.reply(safe(`${title} was skipped.`))
    }
};
