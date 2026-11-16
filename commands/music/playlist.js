const { ApplicationCommandOptionType, escapeMarkdown } = require("discord.js");
const db = require("../../lib/db");
const { musicEmbed } = require("../../lib/music/embed");
const { queueTracks, cantPlay } = require("./play");

const MAX_PLAYLISTS = 20, MAX_TRACKS = 100, MAX_NAME = 40;
const ACTIONS = ["save", "load", "list", "delete"];

module.exports = {
    name: "playlist",
    description: "Save the queue as a playlist and play it again later: save, load, list or delete.",
    aliases: ["pl", "playlists"],
    options: [
        { name: "action", description: "What to do", type: ApplicationCommandOptionType.String, required: true, choices: ACTIONS.map((a) => ({ name: a, value: a })) },
        { name: "name", description: "The playlist's name", type: ApplicationCommandOptionType.String, max_length: MAX_NAME },
    ],
    run: async (client, message, args) => {
        const action = (args[0] ?? "list").toLowerCase(), name = args.slice(1).join(" ").trim();
        const userId = message.author.id;
        if (!ACTIONS.includes(action)) return message.reply("Use `playlist save <name>`, `playlist load <name>`, `playlist list` or `playlist delete <name>` 🌙");
        if (action === "list") {
            const lists = await db.playlistsOf(userId);
            if (!lists.length) return message.reply("No playlists yet. Queue some songs, then `playlist save <name>` 🌙");
            return message.reply({ embeds: [musicEmbed().setAuthor({ name: `🌙 ${message.member.displayName}'s playlists`.slice(0, 256) })
                .setDescription(lists.map((l) => `**${escapeMarkdown(l.name)}** · ${l.count} song${l.count === 1 ? "" : "s"}`).join("\n"))
                .setFooter({ text: `${lists.length}/${MAX_PLAYLISTS} · play one with "playlist load <name>"` })] });
        }
        if (!name) return message.reply(`Which playlist? Try \`playlist ${action} chill\` 🌙`);
        if (name.length > MAX_NAME) return message.reply(`Keep the name under ${MAX_NAME} characters 🌙`);

        if (action === "delete") return message.reply(await db.deletePlaylist(userId, name) ? `Deleted **${escapeMarkdown(name)}**.` : "You don't have a playlist called that 🌙");
        if (action === "save") {
            const player = client.lavalink.getPlayer(message.guild.id);
            const tracks = [player?.queue.current, ...(player?.queue.tracks ?? [])].filter((t) => t?.encoded).slice(0, MAX_TRACKS);
            if (!tracks.length) return message.reply("Nothing's playing to save. Queue some songs with `play` first 🌙");
            if (!(await db.savePlaylist(userId, name, tracks.map((t) => t.encoded), MAX_PLAYLISTS))) {
                return message.reply(`You have ${MAX_PLAYLISTS} playlists already. Delete one with \`playlist delete <name>\` 🌙`);
            }
            return message.reply(`💾 Saved **${escapeMarkdown(name)}** · ${tracks.length} song${tracks.length === 1 ? "" : "s"}${tracks.length === MAX_TRACKS ? ` (the first ${MAX_TRACKS})` : ""}.`);
        }
        // load
        const problem = cantPlay(client, message.member, message.guild.id);
        if (problem) return message.reply(problem);
        const saved = await db.getPlaylist(userId, name);
        if (!saved) return message.reply("You don't have a playlist called that. See yours with `playlist list` 🌙");
        let tracks;
        try {
            tracks = await client.lavalink.nodeManager.leastUsedNodes()[0].decode.multipleTracks(saved.tracks, message.author);
        } catch (err) {
            return message.reply(`The music server couldn't read that playlist: ${err.message}`);
        }
        await queueTracks(client, message.guild.id, message.member.voice.channel.id, message.channel.id, tracks);
        return message.reply(`🎶 Queued **${escapeMarkdown(saved.name)}** · ${tracks.length} song${tracks.length === 1 ? "" : "s"}.`);
    },
};
