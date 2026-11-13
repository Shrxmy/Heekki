const { ApplicationCommandOptionType } = require("discord.js");
const lastfm = require("../../lib/lastfm");
const server = require("../../lib/lastfm/server");
const { getLastfm } = require("../../lib/db");
const { stripHtml, truncate } = require("../../lib/info/format");
const { memberFor } = require("../../lib/loona");
const { musicEmbed, emoji } = require("../../lib/music/embed");

/** Last.fm bios end with a "Read more on Last.fm" link; keep the text only. */
const bio = (summary) => truncate(stripHtml(String(summary ?? "").replace(/<a [^>]*>Read more on Last\.fm<\/a>\.?/i, "")), 350);
const tags = (list) => [].concat(list ?? []).slice(0, 5).map((t) => lastfm.clean(t.name, 30)).join(" · ");

module.exports = {
    name: "artist",
    description: "Info about an artist on Last.fm, with your plays and your rank in this server.",
    aliases: ['a'],
    options: [{ name: 'artist', description: 'Which artist (leave empty for what you are playing)', type: ApplicationCommandOptionType.String, max_length: 100 }],
    bio,
    run: async (client, message, args) => {
        if (!lastfm.hasKey()) return message.reply(lastfm.NO_KEY);
        const subject = await server.subjectFrom(message, args, (t) => t.artist, "artist LOONA");
        if (subject.problem) return message.reply(subject.problem);

        let artist;
        try {
            artist = (await lastfm.call("artist.getInfo", { artist: subject.text, autocorrect: "1" })).artist;
        } catch (err) {
            return message.reply(lastfm.quiet(err.notFound ? `I couldn't find an artist called "${subject.text.slice(0, 100)}" on Last.fm 🌙` : "Last.fm didn't answer, try again in a bit 🌙"));
        }
        // Last.fm no longer serves artist photos, so the cover of their top album stands in.
        const [cover, ranking] = await Promise.all([
            lastfm.call("artist.getTopAlbums", { artist: artist.name, limit: "1" }).then((d) => lastfm.imageUrl([].concat(d.topalbums?.album ?? [])[0]?.image)).catch(() => null),
            server.rankServer(message.guild, (username) =>
                lastfm.call("artist.getInfo", { artist: artist.name, username, autocorrect: "1" }).then((d) => d.artist?.stats?.userplaycount)),
        ]);
        const crown = ranking.failed < ranking.counts.length ? await server.updateCrown(message.guild.id, artist.name, ranking) : null;

        const me = message.author.id;
        const mine = ranking.counts.find((c) => c.id === me);
        const rank = ranking.listeners.findIndex((c) => c.id === me);
        const fields = [];
        if (await getLastfm(me)) {
            fields.push({ name: "Your plays", value: mine?.failed || !mine ? "Couldn't load" : lastfm.plural(mine.plays, "play"), inline: true });
            fields.push({ name: "Server rank", value: rank >= 0 ? `#${rank + 1} of ${ranking.listeners.length}` : "Not ranked yet", inline: true });
        }
        if (crown) fields.push({ name: "👑 Crown", value: `${server.displayName(message.guild, crown.userId)} · ${lastfm.plural(crown.plays, "play")}`, inline: true });
        fields.push(
            { name: "Listeners", value: Number(artist.stats?.listeners ?? 0).toLocaleString("en-US"), inline: true },
            { name: "Scrobbles", value: Number(artist.stats?.playcount ?? 0).toLocaleString("en-US"), inline: true },
        );
        if (tags(artist.tags?.tag)) fields.push({ name: "Tags", value: tags(artist.tags.tag) });

        const host = memberFor(artist.name);
        const embed = musicEmbed(host)
            .setAuthor({ name: `${emoji(host)} Artist` })
            .setTitle(artist.name.slice(0, 256))
            .setURL(lastfm.pageUrl(artist.url))
            .setThumbnail(cover)
            .setDescription(lastfm.clean(bio(artist.bio?.summary), 400) || null)
            .addFields(fields)
            .setFooter({ text: "🌙 Last.fm" });
        return message.reply({ embeds: [embed] });
    }
};
