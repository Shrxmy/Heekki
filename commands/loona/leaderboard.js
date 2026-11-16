const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const db = require("../../lib/db");

const KINDS = {
    cards: { title: "Most photocards", unit: (n) => `${n} card${n === 1 ? "" : "s"}` },
    moon: { title: "Most Moon cards", unit: (n) => `${n} Moon card${n === 1 ? "" : "s"}` },
    coins: { title: "Richest in moon coins", unit: (n) => `${n} coins` },
};
const MEDALS = ["🥇", "🥈", "🥉"];

module.exports = {
    name: "leaderboard",
    description: "This server's top collectors: most cards, most Moon cards, or most coins.",
    aliases: ["lb"],
    options: [{ name: "kind", description: "What to rank by (default: cards)", type: ApplicationCommandOptionType.String,
        choices: Object.keys(KINDS).map((k) => ({ name: k, value: k })) }],
    run: async (client, message, args) => {
        const kind = (args[0] ?? "cards").toLowerCase();
        if (!KINDS[kind]) return message.reply("Rank by `cards`, `moon` or `coins` 🌙");
        const rows = await db.leaderboard(message.guild.id, kind);
        if (!rows.length) return message.reply("Nobody's on the board yet. Start with `pull` 🌙");
        const lines = rows.map((r, i) => `${MEDALS[i] ?? `\`${i + 1}.\``} <@${r.userId}> · ${KINDS[kind].unit(r.score)}`);
        const embed = new EmbedBuilder().setColor("#FFD700").setTitle(`🏆 ${KINDS[kind].title}`.slice(0, 256)).setDescription(lines.join("\n"))
            .setFooter({ text: `${message.guild.name} · leaderboard cards / moon / coins` });
        return message.reply({ embeds: [embed], allowedMentions: { parse: [], repliedUser: true } });
    },
};
