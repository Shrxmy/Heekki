const { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder, escapeMarkdown } = require("discord.js");
const game = require("../../lib/loona/guess");
const pc = require("../../lib/loona/photocards");
const loona = require("../../lib/loona");
const db = require("../../lib/db");

const games = new Map(); // guild id -> { stop() } for the game running there
const PRIZE_CARDS_MAX = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The song's audio on YouTube Music: a result at least a minute long whose title is really this song, or null. */
async function findTrack(client, song, requester) {
    try {
        const res = await client.lavalink.nodeManager.leastUsedNodes()[0].search({ query: `${song.artist} ${song.title}`, source: "ytmsearch" }, requester);
        // YouTube Music sometimes answers with a different song by the same artist; never play that as this one.
        return res.tracks?.slice(0, 5).find((t) => t.info.length >= 60_000 && game.resultMatches(t.info, song)) ?? null;
    } catch {
        return null;
    }
}

const reveal = (song, color) => new EmbedBuilder()
    .setColor(color)
    .setDescription(`It was **${escapeMarkdown(song.title)}** by ${escapeMarkdown(song.artist)}${song.aliases.length ? ` (${song.aliases.map(escapeMarkdown).join(" / ")})` : ""}\nfrom *${escapeMarkdown(song.release)}*`);

async function play(client, message, channel) {
    const guildId = message.guild.id;
    const player = client.lavalink.createPlayer({ guildId, voiceChannelId: channel.id, textChannelId: message.channel.id, selfDeaf: true });
    player.set("guessGame", true); // keeps "now playing" posts (the answers) out of chat
    let stopped = false;
    games.set(guildId, { stop: () => { stopped = true; } });
    const scores = new Map();
    try {
        await player.connect();
        await message.reply(`🎧 **LOONA song quiz!** ${game.ROUNDS} rounds of ${game.CLIP_MS / 1000}-second clips. Type the song's title in this channel; first right answer wins **${game.COINS_PER_ROUND}** moon coins, and the top scorer wins a photocard. \`guess stop\` ends it.`);
        const queue = game.pickSongs(game.ROUNDS + 5); // spares, in case a song can't be found
        // Our player is gone if the music `stop` command or the 3-minutes-alone timer destroyed it; never use another one.
        const ours = () => client.lavalink.getPlayer(guildId) === player;
        let played = 0;
        for (let round = 1; round <= game.ROUNDS && queue.length && !stopped; round++) {
            let song, track;
            while (queue.length && !track) track = await findTrack(client, (song = queue.shift()), message.author);
            if (!track || !ours()) break;

            const color = loona.members[(round - 1) % loona.members.length].color.hex;
            const position = game.clipStart(track.info.length);
            // Listen before the clip starts, so an answer typed in the first second still counts.
            const answering = message.channel.awaitMessages({
                filter: (m) => !m.author.bot && game.isCorrect(m.content, song), max: 1, time: game.ROUND_MS,
            }).then((c) => c.first()).catch(() => null);
            await player.play({ clientTrack: track, position, endTime: position + game.CLIP_MS });
            await message.channel.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(`Round ${round}/${game.ROUNDS}`).setDescription("What's this song? 🌙")] });
            const answer = await answering;
            if (!ours()) break; // stopped mid-round: no coins for a clip that stopped playing
            await player.stopPlaying(false, false).catch(() => {});
            played++;

            if (answer) {
                scores.set(answer.author.id, (scores.get(answer.author.id) ?? 0) + 1);
                // A database hiccup mustn't skip the reveal or the final scores.
                await db.betCoins(guildId, answer.author.id, 0, game.COINS_PER_ROUND)
                    .catch((err) => console.error(`Quiz coins failed for ${answer.author.id}: ${err.message}`));
                answer.react("✅").catch(() => {});
                await message.channel.send({ content: `🎉 <@${answer.author.id}> got it! +${game.COINS_PER_ROUND} moon coins`, embeds: [reveal(song, color)], allowedMentions: { users: [answer.author.id] } });
            } else {
                await message.channel.send({ content: "⏰ Nobody got this one.", embeds: [reveal(song, color)] });
            }
            if (round < game.ROUNDS && !stopped) await sleep(game.BREAK_MS);
        }
        await finish(message, scores, played === game.ROUNDS);
    } finally {
        games.delete(guildId);
        if (client.lavalink.getPlayer(guildId) === player) await player.destroy().catch(() => {}); // never someone else's player
    }
}

/** Scoreboard, then (only after all rounds, so stopping early can't farm cards) a free photocard for each top scorer. */
async function finish(message, scores, complete) {
    const ranking = [...scores].sort((a, b) => b[1] - a[1]);
    const board = ranking.map(([id, s], i) => `\`${i + 1}.\` <@${id}> · ${s} point${s === 1 ? "" : "s"}`).join("\n") || "Nobody scored this time. Next game, Orbit 🌙";
    await message.channel.send({ embeds: [new EmbedBuilder().setColor("#7632A0").setTitle("Final scores").setDescription(board)], allowedMentions: { parse: [] } });

    if (!complete) {
        if (scores.size) await message.channel.send(`The photocard prize is for finishing all ${game.ROUNDS} rounds. Play a full game next time 🌙`);
        return;
    }
    for (const id of game.winners(scores).slice(0, PRIZE_CARDS_MAX)) {
        const c = pc.roll(Math.random, pc.validGroups(await db.getCardGroups(message.guild.id))); // the server's card groups
        const copies = await db.giftPhotocard(message.guild.id, id, c.id);
        const embed = new EmbedBuilder().setColor(c.member.color.hex)
            .setTitle(`Prize: ${pc.fullName(c.member)} · ${c.rarity.label}`)
            .setDescription(copies === 1 ? "✨ New card!" : `You now have ${copies} of this card.`)
            .setImage("attachment://photocard.png").setFooter({ text: pc.credit(c) });
        await message.channel.send({ content: `🏆 <@${id}> wins a photocard!`, embeds: [embed],
            files: [new AttachmentBuilder(await pc.renderPhotocard(c), { name: "photocard.png" })], allowedMentions: { users: [id] } });
    }
}

// --- guess photo: whose card is this? ---------------------------------------------------------------------
const PHOTO_MS = 30_000, PHOTO_COINS = 40, PHOTO_COOLDOWN_S = 10 * 60; // coins at most every 10 minutes, so it can't be farmed
const photoRounds = new Set(); // channel ids with a photo round running

async function photoRound(message) {
    const guildId = message.guild.id, channelId = message.channel.id;
    if (photoRounds.has(channelId)) return message.reply("There's already a photo to guess here 🌙");
    photoRounds.add(channelId);
    try {
        const c = pc.roll(Math.random, pc.validGroups(await db.getCardGroups(guildId))); // the server's card groups
        const photo = await pc.renderPhoto(c);
        if (!photo) return message.reply("I couldn't load a photo just now. Try again in a moment 🌙");
        // Listen before posting, so a very fast answer still counts.
        const answering = message.channel.awaitMessages({ filter: (m) => !m.author.bot && pc.findAnyMember(m.content) === c.member, max: 1, time: PHOTO_MS })
            .then((got) => got.first()).catch(() => null);
        await message.reply({ embeds: [new EmbedBuilder().setColor("#7632A0").setTitle("📸 Who's this?")
            .setDescription(`Type their name in chat. ${PHOTO_MS / 1000} seconds!`).setImage("attachment://who.png")],
        files: [new AttachmentBuilder(photo, { name: "who.png" })] });
        const answer = await answering;
        const reveal = `**${pc.fullName(c.member)}** · ${c.rarity.label} card, from *${escapeMarkdown(c.scan.from)}*`;
        if (!answer) return message.channel.send(`⏰ Time's up! It was ${reveal}`);
        const paid = await db.rewardAfterCooldown(guildId, answer.author.id, "photoguess", PHOTO_COOLDOWN_S, PHOTO_COINS)
            .catch((err) => { console.error(`Photo quiz coins failed: ${err.message}`); return {}; });
        answer.react("✅").catch(() => {});
        const prize = paid.balance !== undefined ? ` +${PHOTO_COINS} moon coins`
            : paid.waitMs ? ` (more coins in ${Math.ceil(paid.waitMs / 60_000)} min)` : "";
        return message.channel.send({ content: `🎉 <@${answer.author.id}> got it!${prize}\nIt was ${reveal}`, allowedMentions: { users: [answer.author.id] } });
    } finally {
        photoRounds.delete(channelId);
    }
}

module.exports = {
    name: "guess",
    description: 'LOONA song quiz in your voice channel, or "guess photo": whose photocard is this?',
    aliases: ["songquiz", "gts"],
    options: [{ name: "action", description: "Leave empty for the song quiz, photo for the photo quiz, or stop the song quiz", type: ApplicationCommandOptionType.String,
        choices: [{ name: "photo", value: "photo" }, { name: "stop", value: "stop" }] }],
    games,
    PHOTO_COINS,
    run: async (client, message, args) => {
        const guildId = message.guild.id;
        if (["photo", "pic", "picture"].includes(args[0]?.toLowerCase())) return photoRound(message);
        if (args[0]?.toLowerCase() === "stop") {
            if (!games.has(guildId)) return message.reply("There's no song quiz running, Orbit 🌙");
            games.get(guildId).stop();
            return message.reply("Okay, this is the last round 🌙");
        }
        const { channel } = message.member.voice;
        if (!channel) return message.reply("Hop into a voice channel first, Orbit 🎧");
        if (games.has(guildId)) return message.reply("A song quiz is already running here 🌙");
        if (!client.lavalink.useable) return message.reply("The music server is taking a nap 💤 Try again in a moment.");
        if (client.lavalink.getPlayer(guildId)) return message.reply("I'm in a voice channel for music right now. Use `stop` first, then start the quiz 🌙");
        return play(client, message, channel);
    },
};
