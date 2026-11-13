const { ApplicationCommandOptionType, EmbedBuilder, escapeMarkdown } = require("discord.js");
const pc = require("../../lib/loona/photocards");
const loona = require("../../lib/loona");
const db = require("../../lib/db");
const { targetMember } = require("../../lib/fun/target");

// One mark per rarity, filled when owned: Common, Rare, Super, Moon.
const MARKS = { common: ["●", "○"], rare: ["◆", "◇"], super: ["★", "☆"], moon: ["🌕", "🌑"] };

function collectionEmbed(member, owned) {
    const rows = loona.members.map((m) => {
        const marks = pc.RARITIES.map((r) => MARKS[r.key][owned.has(`${m.key}-${r.key}`) ? 0 : 1]).join(" ");
        return `${m.animal.split(" ")[0]} \`${m.name.padEnd(8)}\` ${marks}`;
    });
    const done = new Set(pc.completedSets(owned.keys()).map((s) => s.key));
    const sets = pc.SETS.map((s) => `${done.has(s.key) ? "✅" : "▫️"} ${s.label} (+${s.bonus})`);
    const total = [...owned.values()].reduce((a, b) => a + b, 0);
    return new EmbedBuilder()
        .setColor(loona.memberFor(member.id).color.hex)
        .setTitle(`${escapeMarkdown(member.displayName)}'s photocards`.slice(0, 256))
        .setDescription(`${rows.join("\n")}\n\n**Sets**\n${sets.join("\n")}`)
        .setFooter({ text: `${owned.size}/${pc.ALL.length} cards · ${total} pulled · ● Common ◆ Rare ★ Super 🌕 Moon` });
}

module.exports = {
    name: "collection",
    description: "Shows someone's LOONA photocards and set progress.",
    aliases: ["cards", "binder"],
    options: [{ name: "user", description: "Whose collection (leave empty for yours)", type: ApplicationCommandOptionType.User }],
    collectionEmbed,
    run: async (client, message, args) => {
        const member = await targetMember(message, args[0]);
        if (!member) return message.reply("I couldn't find that member 🌙");
        const owned = await db.photocardsOf(message.guild.id, member.id);
        if (!owned.size) {
            return message.reply(member.id === message.author.id
                ? "No photocards yet, Orbit. Your first `pull` today is free 🌙"
                : { content: `**${escapeMarkdown(member.displayName)}** has no photocards yet 🌙`, allowedMentions: { parse: [] } });
        }
        return message.reply({ embeds: [collectionEmbed(member, owned)], allowedMentions: { parse: [], repliedUser: true } });
    },
};
