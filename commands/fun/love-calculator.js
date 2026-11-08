const { ApplicationCommandOptionType } = require("discord.js");
const { loveScore } = require("../../lib/fun/rate");
const { targetMember, quiet } = require("../../lib/fun/target");

const VERDICTS = [[90, "Soulmates."], [70, "A strong orbit."], [40, "There's something there."], [0, "Better as friends."]];

module.exports = {
    name: "love-calculator",
    description: 'How compatible are two members? (changes daily)',
    aliases: ['love', 'ship'],
    options: [
        { name: 'user', description: 'The first person', type: ApplicationCommandOptionType.User, required: true },
        { name: 'other', description: 'The second person (leave empty for yourself)', type: ApplicationCommandOptionType.User },
    ],
    run: async (client, message, args) => {
        if (!args[0]) return message.reply("Mention someone, like `love-calculator @friend`.");
        const a = await targetMember(message, args[0]);
        const b = await targetMember(message, args[1]);
        if (!a || !b) return message.reply("I couldn't find that member.");
        if (a.id === b.id) return message.reply("Self-love is 100%. Pick someone else to compare with.");
        const score = loveScore(a.id, b.id);
        const bar = "█".repeat(Math.round(score / 10)) + "░".repeat(10 - Math.round(score / 10));
        const verdict = VERDICTS.find(([min]) => score >= min)[1];
        return message.reply(quiet(`💕 **${a.displayName}** + **${b.displayName}**\n\`${bar}\` **${score}%** ${verdict}`)); // nicknames can't ping
    }
};
