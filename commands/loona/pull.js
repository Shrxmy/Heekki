const { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const pc = require("../../lib/loona/photocards");
const loona = require("../../lib/loona");
const db = require("../../lib/db");
const { OWNER_IDS } = require("../../config");

// Zero-padded ("2026-11-04"), so days compare correctly as text in the database.
const today = () => { const { y, m, d } = loona.koreaDate(new Date()); return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; };

/** Pays any set bonuses this pull completed; returns the lines to show. */
async function payNewSets(guildId, userId, owned) {
    const lines = [];
    for (const set of pc.completedSets(owned.keys())) {
        if (await db.paySetBonus(guildId, userId, set.key, set.bonus)) lines.push(`🎉 **${set.label}** set complete! +${set.bonus} moon coins`);
    }
    return lines;
}

module.exports = {
    name: "pull",
    description: `Pull a photocard (or "pull twice" for one group): free once a day, then ${pc.PRICE} moon coins.`,
    aliases: ["pc", "photocard"],
    options: [{ name: "group", description: "Only this group (one of the server's card groups)", type: ApplicationCommandOptionType.String }],
    today,
    run: async (client, message, args) => {
        const guildId = message.guild.id, userId = message.author.id;
        // Paying and saving the card are one database step, done before drawing, so a failed upload never loses a card.
        // The server's card groups (card-groups), or just the one named: "pull twice".
        const groups = pc.validGroups(await db.getCardGroups(guildId));
        const asked = args.length ? pc.findGroup(args.join(" ")) : null;
        if (args.length && !asked) return message.reply(`I don't know that group. This server pulls from ${groups.map((k) => `**${pc.GROUPS.get(k).short}**`).join(", ")} 🌙`);
        if (asked && !groups.includes(asked.key)) return message.reply(`**${asked.short}** cards aren't on in this server. An admin can add them with \`card-groups\` 🌙`);
        const c = pc.roll(Math.random, asked ? [asked.key] : groups);
        // The bot owner (OWNER_ID in .env) pulls for free without using the daily pull, for testing.
        const owner = OWNER_IDS.includes(userId);
        const paid = owner ? { owner, copies: await db.giftPhotocard(guildId, userId, c.id) }
            : await db.pullPhotocard(guildId, userId, today(), pc.PRICE, c.id);
        if (!paid) return message.reply(`Your free pull for today is used, and a pull costs **${pc.PRICE}** moon coins (you have **${await db.getCoins(guildId, userId)}**). Win some with \`slots\`, or come back tomorrow 🌙`);
        const { copies } = paid;
        const owned = await db.photocardsOf(guildId, userId);
        const bonuses = await payNewSets(guildId, userId, owned);

        const { member, rarity } = c;
        const embed = new EmbedBuilder()
            .setColor(member.color.hex)
            .setAuthor({ name: `${message.member.displayName} pulled a photocard`.slice(0, 256), iconURL: message.author.displayAvatarURL?.() || undefined })
            .setTitle(`${pc.fullName(member)} · ${rarity.label}`)
            .setDescription([
                copies === 1 ? "✨ New card!" : `You now have ${copies} of this card.`,
                `${paid.owner ? "Owner pull (free)" : paid.free ? "Today's free pull" : `-${pc.PRICE} moon coins`} · Balance **${await db.getCoins(guildId, userId)}** · Collection **${owned.size}/${pc.ALL.length}**`,
                ...bonuses,
            ].join("\n"))
            .setImage("attachment://photocard.png")
            .setFooter({ text: pc.credit(c) });
        // HyeJu has no personal Instagram, so her cards have no button.
        const components = member.instagram ? [new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setStyle(ButtonStyle.Link).setLabel(`@${member.instagram} on Instagram`).setURL(`https://www.instagram.com/${member.instagram}/`))] : [];
        const files = [new AttachmentBuilder(await pc.renderPhotocard(c), { name: "photocard.png" })];
        return message.reply({ embeds: [embed], files, components, allowedMentions: { parse: [], repliedUser: true } });
    },
};
