const { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const pc = require("../../lib/loona/photocards");
const db = require("../../lib/db");

module.exports = {
    name: "showcase",
    description: 'Show off a photocard you own, like "showcase kim lip moon".',
    aliases: ["show", "card", "view"],
    options: [{ name: "card", description: 'The card, like "kim lip moon" or "chuu rare"', type: ApplicationCommandOptionType.String, required: true }],
    run: async (client, message, args) => {
        if (!args.length) return message.reply("Which card? Try `showcase kim lip moon` (see yours with `collection`) 🌙");
        const c = pc.parseCard(args);
        if (!c) return message.reply("I don't know that card. Try `showcase chuu rare` 🌙");
        const copies = (await db.photocardsOf(message.guild.id, message.author.id)).get(c.id) ?? 0;
        if (!copies) return message.reply(`You don't have **${pc.fullName(c.member)} · ${c.rarity.label}** yet. Keep pulling 🌙`);

        const embed = new EmbedBuilder()
            .setColor(c.member.color.hex)
            .setAuthor({ name: `${message.member.displayName}'s card`.slice(0, 256), iconURL: message.author.displayAvatarURL?.() || undefined })
            .setTitle(`${pc.fullName(c.member)} · ${c.rarity.label}`)
            .setDescription(copies > 1 ? `They have ${copies} of this card.` : null)
            .setImage("attachment://photocard.png")
            .setFooter({ text: pc.credit(c) });
        return message.reply({ embeds: [embed], files: [new AttachmentBuilder(await pc.renderPhotocard(c), { name: "photocard.png" })],
            allowedMentions: { parse: [], repliedUser: true } });
    },
};
