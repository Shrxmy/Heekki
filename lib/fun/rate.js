// "How cute/smart/... is X" scores: random-looking, but the same person gets the same score all day.
const { createHash } = require("node:crypto");
const { ApplicationCommandOptionType } = require("discord.js");
const { targetMember, quiet } = require("./target");

const dayKey = (date) => date.toISOString().slice(0, 10);

/** 0-100, stable for the same kind + id + UTC day. */
function rating(kind, id, date = new Date()) {
    return createHash("sha256").update(`${kind}:${id}:${dayKey(date)}`).digest().readUInt32BE(0) % 101;
}

/** 0-100 for a pair; the order of the two people doesn't matter. */
const loveScore = (a, b, date = new Date()) => rating("love", [a, b].sort().join("+"), date);

/** Builds cuterate / dumbrate / smartrate: `lines` are [minimum score, verdict] from highest to lowest. */
const rateCommand = ({ kind, adjective, aliases, lines }) => ({
    name: `${kind}rate`,
    description: `How ${adjective} is someone today? (changes daily)`,
    aliases,
    options: [{ name: 'user', description: 'Who to rate (leave empty for yourself)', type: ApplicationCommandOptionType.User }],
    run: async (client, message, args) => {
        const member = await targetMember(message, args[0]);
        if (!member) return message.reply("I couldn't find that member.");
        const score = rating(kind, member.id);
        const verdict = lines.find(([min]) => score >= min)[1];
        // Nicknames are user-controlled text: don't let one smuggle in a ping.
        return message.reply(quiet(`**${member.displayName}** is **${score}%** ${adjective} today. ${verdict}`));
    },
});

module.exports = { rating, loveScore, rateCommand };
