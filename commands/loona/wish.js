const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const pc = require("../../lib/loona/photocards");
const db = require("../../lib/db");

const MAX_WISHES = 10;
const name = (c) => `**${pc.fullName(c.member)} · ${c.rarity.label}**`;

module.exports = {
    name: "wish",
    description: 'Wishlist a card and get pinged when it drops: "wish chuu moon", "wish remove chuu moon", or "wish".',
    aliases: ["wishlist", "wl"],
    options: [{ name: "card", description: '"chuu moon" to add, "remove chuu moon", or empty to see your list', type: ApplicationCommandOptionType.String }],
    MAX_WISHES,
    run: async (client, message, args) => {
        const guildId = message.guild.id, userId = message.author.id;
        const words = args.join(" ").split(/\s+/).filter(Boolean);
        if (!words.length) {
            const [wishes, owned] = await Promise.all([db.wishesOf(guildId, userId), db.photocardsOf(guildId, userId)]);
            if (!wishes.length) return message.reply("Your wishlist is empty. Add a card with `wish chuu moon` and drops of it will ping you 🌙");
            const lines = wishes.map((id) => pc.findCard(id)).filter(Boolean).map((c) => `${owned.has(c.id) ? "✅" : "💫"} ${name(c)}`);
            return message.reply({ embeds: [new EmbedBuilder().setColor("#7632A0").setTitle(`${message.member.displayName}'s wishlist`.slice(0, 256))
                .setDescription(lines.join("\n")).setFooter({ text: `${wishes.length}/${MAX_WISHES} · ✅ = you have it now` })] });
        }
        const remove = ["remove", "delete", "rm", "unwish"].includes(words[0].toLowerCase());
        const c = pc.parseCard(remove ? words.slice(1) : words);
        if (!c) return message.reply("I don't know that card. Try `wish chuu moon` 🌙");
        if (remove) return message.reply(await db.removeWish(guildId, userId, c.id) ? `Took ${name(c)} off your wishlist.` : `${name(c)} isn't on your wishlist 🌙`);
        if ((await db.wishesOf(guildId, userId)).includes(c.id)) return message.reply(`${name(c)} is already on your wishlist 🌙`);
        if (!(await db.addWish(guildId, userId, c.id, MAX_WISHES))) return message.reply(`Your wishlist is full (${MAX_WISHES} cards). Remove one with \`wish remove <card>\` 🌙`);
        return message.reply(`💫 Added ${name(c)} to your wishlist. I'll ping you when it drops here.`);
    },
};
