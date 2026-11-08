const { ApplicationCommandOptionType, escapeMarkdown } = require("discord.js");
const { musicEmbed, trackEmbed, link, length, djFor, emoji } = require("../../lib/music/embed");

module.exports = {
    name: "play",
    description: 'Plays a requested song.',
    aliases: ['p'],
    options: [{ name: 'query', description: 'A song name, or a YouTube/Spotify link', type: ApplicationCommandOptionType.String, required: true }],
    run: async (client, message, args) => {
        const { channel } = message.member.voice;

        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (!args.length) return message.reply("What should we listen to, Orbit? Try `play Butterfly` 🦋");
        if (!client.lavalink.useable) return message.reply("The music server is taking a nap 💤 Try again in a moment.");

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
            return message.reply(`Something went wrong while searching: ${err.message}`);
        }

        switch (res.loadType) {
            case 'empty': {
                return message.reply("I couldn't find that song, Orbit. Try another name or a link 🌙");
            }
            case 'track': {
                await enqueue(res.tracks[0]);
                return message.channel.send({ embeds: [trackEmbed(res.tracks[0], "added this to the queue")] });
            }
            case 'playlist': {
                await enqueue(res.tracks);
                const dj = djFor(res.tracks[0]);
                const playlist = musicEmbed(dj)
                    .setAuthor({ name: `${emoji(dj)} ${dj.name} added a playlist to the queue` })
                    .setDescription(`**${escapeMarkdown(String(res.playlist?.name ?? 'Playlist').slice(0, 200))}** · ${res.tracks.length} tracks`)
                    .setThumbnail(res.tracks[0]?.info.artworkUrl ?? null)
                    .setFooter({ text: `For ${message.author.globalName ?? message.author.username}`, iconURL: message.author.displayAvatarURL() });

                return message.channel.send({embeds: [playlist]});
            }
            case 'search': {
                let max = 5, collected, filter = (m) => m.author.id === message.author.id && /^(\d+|end)$/i.test(m.content);
                if (res.tracks.length < max) max = res.tracks.length;
                const results = res.tracks
                    .slice(0, max)
                    .map((track, index) => `**${index + 1}.** ${link(track)} · \`${length(track)}\``)
                    .join('\n');

                const searchResult = musicEmbed()
                    .setAuthor({ name: "🌙 Which one, Orbit?" })
                    .setDescription(results)
                    .setFooter({ text: `Type a number from 1 to ${max}, or "end" to cancel · 30 seconds` });

                await message.channel.send({embeds: [searchResult]});

                try {
                    collected = await message.channel.awaitMessages({ filter, max: 1, time: 30e3, errors: ['time'] });
                } catch (e) {
                    return message.reply("Time's up, no song picked 🌙");
                }

                const first = collected.first().content;

                if (first.toLowerCase() === 'end') {
                    return message.channel.send("Okay, cancelled 🌙");
                }

                const index = Number(first) - 1;
                if (index < 0 || index > max - 1) {
                    return message.reply(`Pick a number from 1 to ${max}, Orbit.`);
                }

                const track = res.tracks[index];
                await enqueue(track);

                return message.channel.send({ embeds: [trackEmbed(track, "added this to the queue")] });
            }
        }
    }
};
