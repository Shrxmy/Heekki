const { ApplicationCommandOptionType } = require("discord.js");
const lastfm = require("../../lib/lastfm");
const { getLastfm } = require("../../lib/db");
const { memberFor } = require("../../lib/loona");
const { musicEmbed, emoji } = require("../../lib/music/embed");

const TOP = 500, SHOWN = 10;

/** How two top-artist lists overlap. a/b: Map of artist name -> plays. */
function compare(a, b) {
    const common = [...a.keys()].filter((name) => b.has(name))
        .map((name) => ({ name, a: a.get(name), b: b.get(name) }))
        .sort((x, y) => Math.min(y.a, y.b) - Math.min(x.a, x.b));
    const score = Math.min(a.size, b.size) ? common.length / Math.min(a.size, b.size) : 0;
    return { common, score };
}

/** 🌕🌕🌕🌑🌑… : a moon for every 10%. */
const moons = (score) => { const full = Math.round(score * 10); return "🌕".repeat(full) + "🌑".repeat(10 - full); };

const topArtists = (user, period) => lastfm.call("user.getTopArtists", { user, period, limit: String(TOP) })
    .then((d) => new Map([].concat(d.topartists?.artist ?? []).map((x) => [x.name, Number(x.playcount) || 0])));

module.exports = {
    name: "taste",
    description: "Compares your top artists on Last.fm with someone else's.",
    aliases: ['compare'],
    options: [
        { name: 'user', description: 'Who to compare with', type: ApplicationCommandOptionType.User, required: true },
        { name: 'period', description: 'Time period (default: all time)', type: ApplicationCommandOptionType.String, choices: lastfm.PERIOD_CHOICES },
    ],
    compare, moons,
    run: async (client, message, args) => {
        if (!lastfm.hasKey()) return message.reply(lastfm.NO_KEY);
        const mine = getLastfm(message.author.id);
        if (!mine) return message.reply("I don't know your Last.fm yet, Orbit. Link it with `fmset <username>` 🌙");
        if (!args.some((a) => /\d{17,20}/.test(a))) return message.reply("Who should I compare you with? Try `taste @someone` 🌙");
        const { member, username, problem } = await lastfm.whoFrom(message, args);
        if (problem) return message.reply(lastfm.quiet(problem));
        if (member.id === message.author.id) return message.reply("Your taste matches yourself perfectly, Orbit 🌕 Try someone else!");
        const period = args.some((a) => Object.hasOwn(lastfm.PERIODS, a.toLowerCase())) ? lastfm.periodFrom(args) : lastfm.PERIODS.alltime;

        let a, b;
        try {
            [a, b] = await Promise.all([topArtists(mine, period.api), topArtists(username, period.api)]);
        } catch {
            return message.reply("Last.fm didn't answer, try again in a bit 🌙");
        }
        const { common, score } = compare(a, b);
        const me = message.member?.displayName ?? "You";
        const rows = common.slice(0, SHOWN).map((c) => `**${lastfm.clean(c.name, 60)}** · ${lastfm.plural(c.a, "play")} vs ${lastfm.plural(c.b, "play")}`);
        const host = memberFor(`${mine}${username}`);
        const embed = musicEmbed(host)
            .setAuthor({ name: `${emoji(host)} ${me} and ${member.displayName}, ${period.label}`.slice(0, 256) })
            .setTitle(`${moons(score)} ${Math.round(score * 100)}% match`)
            .setDescription([
                common.length ? `You share **${common.length}** of your top artists.` : "No artists in common yet. Maybe swap some recommendations? 🌙",
                rows.join("\n"),
            ].filter(Boolean).join("\n\n").slice(0, 4096))
            .setFooter({ text: `🌙 Compared each person's top ${TOP} artists on Last.fm` });
        return message.reply({ embeds: [embed] });
    }
};
