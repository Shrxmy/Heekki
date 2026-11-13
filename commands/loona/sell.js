const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const pc = require("../../lib/loona/photocards");
const loona = require("../../lib/loona");
const db = require("../../lib/db");

const priceList = pc.RARITIES.map((r) => `${r.label} ${pc.SELL_PRICES[r.key]}`).join(" · ");

/** The card named in args ("kim lip rare", "chuu-moon"), or null. */
function cardFrom(args) {
    const words = args.map((a) => a.toLowerCase());
    const rarity = pc.RARITIES.find((r) => r.key === words.at(-1));
    if (rarity) {
        const member = loona.findMember(words.slice(0, -1).join(" "));
        return member ? pc.card(member, rarity) : null;
    }
    return pc.findCard(words.join(""));
}

module.exports = {
    name: "sell",
    description: `Sell duplicate photocards for moon coins (you always keep one of each). ${priceList}.`.slice(0, 100),
    aliases: ["sellcards"],
    options: [{ name: "cards", description: '"dupes" for all extras, or one card like "kim lip rare"', type: ApplicationCommandOptionType.String, required: true }],
    cardFrom,
    run: async (client, message, args) => {
        if (!args.length) return message.reply(`Sell your extras with \`sell dupes\`, or one card with \`sell kim lip rare\`. Prices: ${priceList}.`);
        const all = ["dupes", "duplicates", "all", "extras"].includes(args.join(" ").toLowerCase());
        const card = all ? null : cardFrom(args);
        if (!all && !card) return message.reply(`I don't know that card. Try \`sell chuu moon\` or \`sell dupes\` 🌙`);

        const { sold, coins, balance } = await db.sellDuplicates(message.guild.id, message.author.id, pc.SELL_PRICES, card?.id ?? null);
        if (!sold.length) {
            return message.reply(card ? `You don't have a spare **${card.member.name} · ${card.rarity.label}** to sell (you always keep one) 🌙`
                : "You don't have any duplicates to sell yet. Keep pulling 🌙");
        }
        const lines = sold.map(({ cardId, copies }) => {
            const c = pc.findCard(cardId);
            return `${c.member.name} · ${c.rarity.label} ×${copies} → **${copies * pc.SELL_PRICES[c.rarity.key]}**`;
        });
        const embed = new EmbedBuilder()
            .setColor("#FFD700")
            .setTitle(`Sold ${sold.reduce((n, s) => n + s.copies, 0)} photocard${sold.length === 1 && sold[0].copies === 1 ? "" : "s"}`)
            .setDescription(`${lines.join("\n").slice(0, 3900)}\n\n**+${coins}** moon coins · Balance **${balance}**`);
        return message.reply({ embeds: [embed] });
    },
};
