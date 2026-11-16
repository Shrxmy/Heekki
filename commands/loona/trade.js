const { ActionRowBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, MessageFlags } = require("discord.js");
const pc = require("../../lib/loona/photocards");
const db = require("../../lib/db");

const OFFER_MS = 2 * 60_000, MAX_COINS = 1_000_000;

/** One side of a trade: "kim lip rare" -> { cardId }, "300" or "300 coins" -> { coins }, else null. */
function parseSide(text) {
    const coins = text.trim().match(/^(\d+)\s*(?:c|coins?|moon\s*coins?)?$/i);
    if (coins) { const n = Number(coins[1]); return n >= 1 && n <= MAX_COINS ? { coins: n } : null; }
    const c = text.trim() && pc.parseCard(text.trim().split(/\s+/));
    return c ? { cardId: c.id } : null;
}
/** "kim lip rare for chuu moon" -> { give, get }, or null (coins for coins isn't a trade). */
function parseOffer(text) {
    const parts = text.split(/\s+for\s+/i);
    if (parts.length !== 2) return null;
    const [give, get] = parts.map(parseSide);
    return give && get && !(give.coins && get.coins) ? { give, get } : null;
}
const describe = (item) => (item.coins ? `**${item.coins}** moon coins` : `**${pc.fullName(pc.findCard(item.cardId).member)} · ${pc.findCard(item.cardId).rarity.label}**`);

/** Whether `userId` has `item` right now (checked again, atomically, when the trade happens). */
async function has(guildId, userId, item) {
    return item.coins ? (await db.getCoins(guildId, userId)) >= item.coins : ((await db.photocardsOf(guildId, userId)).get(item.cardId) ?? 0) > 0;
}

const buttons = (disabled) => [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("trade-accept").setLabel("Accept").setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId("trade-decline").setLabel("Decline").setStyle(ButtonStyle.Danger).setDisabled(disabled))];

module.exports = {
    name: "trade",
    description: 'Trade cards or coins: "trade @friend kim lip rare for chuu moon" (or "300 for chuu moon").',
    aliases: ["swap"],
    options: [
        { name: "user", description: "Who to trade with", type: ApplicationCommandOptionType.User, required: true },
        { name: "offer", description: '"<yours> for <theirs>", like "kim lip rare for chuu moon" or "300 for chuu moon"', type: ApplicationCommandOptionType.String, required: true },
    ],
    parseOffer,
    run: async (client, message, args) => {
        const usage = "Try `trade @friend kim lip rare for chuu moon`. Either side can be coins: `trade @friend 300 for chuu moon` 🌙";
        const id = args[0]?.match(/^(?:<@!?)?(\d{17,20})>?$/)?.[1];
        if (!id) return message.reply(usage);
        const offer = parseOffer(args.slice(1).join(" "));
        if (!offer) return message.reply(`I couldn't read that trade. ${usage}`);
        const guildId = message.guild.id, me = message.author;
        const them = (await message.guild.members.fetch(id).catch(() => null))?.user;
        if (!them || them.bot || them.id === me.id) return message.reply("Pick another (human) member of this server to trade with 🌙");
        if (!(await has(guildId, me.id, offer.give))) return message.reply(`You don't have ${describe(offer.give)} to give 🌙`);
        if (!(await has(guildId, them.id, offer.get))) return message.reply({ content: `<@${them.id}> doesn't have ${describe(offer.get)} 🌙`, allowedMentions: { parse: [] } });

        const embed = new EmbedBuilder().setColor("#7632A0").setTitle("🤝 Trade offer")
            .setDescription(`<@${me.id}> gives ${describe(offer.give)}\n<@${them.id}> gives ${describe(offer.get)}`)
            .setFooter({ text: `Only ${them.username} can accept · either of you can decline · ${OFFER_MS / 60_000} minutes` });
        const sent = await message.reply({ content: `<@${them.id}>, <@${me.id}> wants to trade with you.`, embeds: [embed], components: buttons(false),
            allowedMentions: { users: [them.id] } });
        const collector = sent.createMessageComponentCollector({ componentType: ComponentType.Button, time: OFFER_MS });
        collector.on("collect", async (i) => {
            if (![me.id, them.id].includes(i.user.id)) return i.reply({ content: "This isn't your trade.", flags: MessageFlags.Ephemeral });
            if (i.customId === "trade-accept" && i.user.id !== them.id) return i.reply({ content: `Only <@${them.id}> can accept.`, flags: MessageFlags.Ephemeral });
            collector.stop("answered"); // before any await, so a double click can't trade twice
            if (i.customId === "trade-decline") return i.update({ content: `Trade ${i.user.id === me.id ? "cancelled" : "declined"}.`, components: buttons(true) });
            const result = await db.tradePhotocards(guildId, me.id, them.id, offer.give, offer.get).catch((err) => {
                console.error(`Trade failed: ${err.message}`);
                return { ok: false };
            });
            const text = result.ok ? "✅ Traded! Check with `collection`."
                : result.missing ? `<@${result.missing}> doesn't have ${describe(result.missing === me.id ? offer.give : offer.get)} anymore, so nothing was traded.`
                    : "Something went wrong, so nothing was traded. Try again 🌙";
            return i.update({ content: text, components: buttons(true), allowedMentions: { parse: [] } });
        });
        collector.on("end", (_, reason) => {
            if (reason !== "answered") sent.edit({ content: "The trade offer expired.", components: buttons(true), allowedMentions: { parse: [] } }).catch(() => {});
        });
    },
};
