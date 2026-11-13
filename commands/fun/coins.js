const { ApplicationCommandOptionType, escapeMarkdown } = require("discord.js");
const db = require("../../lib/db");
const { targetMember } = require("../../lib/fun/target");

module.exports = {
    name: "coins",
    description: "Shows someone's moon coins (yours if you leave it empty).",
    aliases: ["balance", "bal"],
    options: [{ name: "user", description: "Whose coins", type: ApplicationCommandOptionType.User }],
    run: async (client, message, args) => {
        const member = await targetMember(message, args[0]);
        if (!member) return message.reply("I couldn't find that member 🌙");
        const balance = await db.getCoins(message.guild.id, member.id);
        const who = member.id === message.author.id ? "You have" : `**${escapeMarkdown(member.displayName)}** has`;
        return message.reply({ content: `🌙 ${who} **${balance}** moon coins. Earn more with \`daily\`, \`practice\`, \`slots\`, \`guess\` and \`sell dupes\`.`, allowedMentions: { parse: [] } });
    },
};
