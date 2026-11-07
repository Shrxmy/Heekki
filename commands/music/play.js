const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");

module.exports = {
    name: "play",
    description: 'Plays a requested song.',
    aliases: ['p'],
    options: [{ name: 'query', description: 'A song name, or a YouTube/Spotify link', type: ApplicationCommandOptionType.String, required: true }],
    run: async (client, message, args) => {
        const { channel } = message.member.voice;

        if (!channel) return message.reply('You need to join a voice channel.');
        if (!args.length) return message.reply('You need to give me a URL or a Search Term.');
        if (!client.lavalink.useable) return message.reply('The music server is not connected right now, try again in a moment.');

        // Get (or re-create) the player right before queueing: queueEnd destroys it,
        // which can happen while we wait on the search or the user's pick.
        const livePlayer = async () => {
            const player = client.lavalink.getPlayer(message.guild.id) ?? client.lavalink.createPlayer({
                guildId: message.guild.id,
                voiceChannelId: channel.id,
                textChannelId: message.channel.id,
                selfDeaf: true,
            });
            if (!player.connected) await player.connect();
            return player;
        };
        const enqueue = async (tracks) => {
            const player = await livePlayer();
            await player.queue.add(tracks);
            if (!player.playing && !player.paused && !player.queue.current) await player.play();
        };

        const search = args.join(' ');
        let res;

        try {
            res = await client.lavalink.nodeManager.leastUsedNodes()[0].search({ query: search }, message.author);
            if (res.loadType === 'error') throw new Error(res.exception?.message ?? 'Unknown error');
        } catch (err) {
            return message.reply(`There was an error while searching: ${err.message}`);
        }

        switch (res.loadType) {
            case 'empty': {
                return message.reply('There were no results found.');
            }
            case 'track': {
                const playmusic = new EmbedBuilder()
                .setColor('#95E8A3')
                .setAuthor({ name: `Enqueuing:`, iconURL: client.user.displayAvatarURL() })
                .setDescription(`${res.tracks[0].info.title}`)
                .setFooter({ text: `To check curent queue use the queue command.` })
                .setTimestamp()

                await enqueue(res.tracks[0]);
                return message.channel.send({embeds: [playmusic]});
            }
            case 'playlist': {
                await enqueue(res.tracks);
                const playlist = new EmbedBuilder()
                .setColor('#95E8A3')
                .setAuthor({ name: `Enqueuing playlist:`, iconURL: client.user.displayAvatarURL() })
                .setDescription(`\`${res.playlist?.name ?? 'Playlist'}\` with ${res.tracks.length} tracks.`)
                .setFooter({ text: `To check curent queue use the queue command.` })
                .setTimestamp()

                return message.channel.send({embeds: [playlist]});
            }
            case 'search': {
                let max = 5, collected, filter = (m) => m.author.id === message.author.id && /^(\d+|end)$/i.test(m.content);
                if (res.tracks.length < max) max = res.tracks.length;
                const results = res.tracks
                    .slice(0, max)
                    .map((track, index) => `${++index} - `+`[${track.info.title}](${track.info.uri})`)
                    .join('\n');

                const searchResult = new EmbedBuilder()
                        .setColor('#95E8A3')
                        .setTitle('Search Results: ')
                        .setDescription(results)
                        .addFields({ name: 'Cancel Search: ', value: 'Type end or any other number to cancel the search', inline: true })
                        .setTimestamp()

                await message.channel.send({embeds: [searchResult]});

                try {
                    collected = await message.channel.awaitMessages({ filter, max: 1, time: 30e3, errors: ['time'] });
                } catch (e) {
                    return message.reply("You didn't provide a selection.");
                }

                const first = collected.first().content;

                if (first.toLowerCase() === 'end') {
                    return message.channel.send('Cancelled Selection.');
                }

                const index = Number(first) - 1;
                if (index < 0 || index > max - 1) {
                    return message.reply(`The number you provided too small or too big (1-${max}).`);
                }

                const track = res.tracks[index];
                await enqueue(track);

                const trackadd = new EmbedBuilder()
                .setColor('#95E8A3')
                .setAuthor({ name: `Added To Queue`, iconURL: client.user.displayAvatarURL() })
                .setDescription(`[${track.info.title}](${track.info.uri})`)
                .addFields({ name: `Requested By : `, value: `${track.requester}`, inline: true })
                .setFooter({ text: `To check curent queue use the queue command.` })

                return message.channel.send({embeds: [trackadd]});
            }
        }
    }
};
