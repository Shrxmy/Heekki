const { ApplicationCommandOptionType, AttachmentBuilder } = require("discord.js");
const lastfm = require("../../lib/lastfm");
const { drawCollage, sizeFrom, MAX_SIDE } = require("../../lib/lastfm/collage");
const { memberFor } = require("../../lib/loona");
const { musicEmbed, emoji } = require("../../lib/music/embed");

module.exports = {
    name: "collage",
    description: "A picture of your top albums on Last.fm (3x3 by default, up to 10x10).",
    aliases: ['fmc', 'chart', 'c'],
    options: [
        { name: 'size', description: 'Grid size like 3x3, 5x5 or 4x6 (up to 10x10)', type: ApplicationCommandOptionType.String, max_length: 5 },
        { name: 'period', description: 'Time period (default: week)', type: ApplicationCommandOptionType.String, choices: lastfm.PERIOD_CHOICES },
        { name: 'titles', description: 'Album names on the tiles (default: show)', type: ApplicationCommandOptionType.String, choices: [{ name: 'hide', value: 'notitles' }] },
        { name: 'playcounts', description: 'Play counts on the tiles (default: hide)', type: ApplicationCommandOptionType.String, choices: [{ name: 'show', value: 'plays' }] },
        { name: 'user', description: 'Who (leave empty for yourself)', type: ApplicationCommandOptionType.User },
    ],
    run: async (client, message, args) => {
        if (!lastfm.hasKey()) return message.reply(lastfm.NO_KEY);
        const size = sizeFrom(args);
        if (!size) return message.reply(`Pick a size up to ${MAX_SIDE}x${MAX_SIDE}, like \`collage 5x5\` 🌙`);
        const { member, username, problem } = await lastfm.whoFrom(message, args);
        if (problem) return message.reply(lastfm.quiet(problem));
        const period = lastfm.periodFrom(args);
        const flags = new Set(args.map((a) => a.toLowerCase()));

        let albums;
        try {
            albums = [].concat((await lastfm.call("user.getTopAlbums", { user: username, period: period.api, limit: String(size.cols * size.rows) })).topalbums?.album ?? []);
        } catch {
            return message.reply("Last.fm didn't answer, try again in a bit 🌙");
        }
        if (!albums.length) return message.reply(lastfm.quiet(`**${lastfm.clean(member.displayName)}** hasn't scrobbled any albums ${period.label} 🌙`));

        const picture = await drawCollage(
            albums.map((a) => ({ name: a.name, artist: a.artist?.name, image: lastfm.imageUrl(a.image), plays: a.playcount })),
            { ...size, titles: !flags.has("notitles"), plays: flags.has("plays") });
        const host = memberFor(username);
        const embed = musicEmbed(host)
            .setAuthor({ name: `${emoji(host)} ${member.displayName}'s top albums, ${period.label}`.slice(0, 256), iconURL: member.displayAvatarURL?.() ?? undefined })
            .setImage("attachment://collage.jpg")
            .setFooter({ text: `🌙 ${size.cols}x${size.rows} · Last.fm · ${username}` });
        return message.reply({ embeds: [embed], files: [new AttachmentBuilder(picture, { name: "collage.jpg" })] });
    }
};
