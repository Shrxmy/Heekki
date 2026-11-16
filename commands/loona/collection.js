const { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder, escapeMarkdown } = require("discord.js");
const pc = require("../../lib/loona/photocards");
const loona = require("../../lib/loona");
const db = require("../../lib/db");
const { targetMember } = require("../../lib/fun/target");

// One mark per rarity, filled when owned: Common, Rare, Super, Moon.
const MARKS = { common: ["●", "○"], rare: ["◆", "◇"], super: ["★", "☆"], moon: ["🌕", "🌑"] };
const LEGEND = "● Common ◆ Rare ★ Super 🌕 Moon";
const spares = (owned, cards) => cards.filter((c) => (owned.get(c.id) ?? 0) > 1);
const spareCoins = (owned, cards) => cards.reduce((s, c) => s + Math.max(0, (owned.get(c.id) ?? 0) - 1) * pc.SELL_PRICES[c.rarity.key], 0);

/** Spare copies with what they'd sell for, and the total `sell dupes` would pay. */
function dupeList(owned, cards) {
    const dupes = spares(owned, cards).map((c) => `${pc.fullName(c.member)} · ${c.rarity.label} ×${owned.get(c.id)} (${owned.get(c.id) - 1} spare, ${(owned.get(c.id) - 1) * pc.SELL_PRICES[c.rarity.key]} coins)`);
    if (!dupes.length) return "";
    return `\n\n**Duplicates** · worth ${spareCoins(owned, cards)} with \`sell dupes\`\n${dupes.slice(0, 15).join("\n")}${dupes.length > 15 ? `\n…and ${dupes.length - 15} more` : ""}`;
}

/** One group: each member's rarities, the group's sets, and its duplicates. */
function collectionEmbed(member, owned, groupKey = "loona") {
    const group = pc.GROUPS.get(groupKey);
    const width = Math.max(...group.members.map((m) => m.name.length));
    const rows = group.members.map((m) => {
        const marks = pc.RARITIES.map((r) => MARKS[r.key][owned.has(`${m.key}-${r.key}`) ? 0 : 1]).join(" ");
        return `${m.animal ? `${m.animal.split(" ")[0]} ` : ""}\`${m.name.padEnd(width)}\` ${marks}`;
    });
    const done = new Set(pc.completedSets(owned.keys()).map((s) => s.key));
    const sets = pc.SETS.filter((s) => s.group === groupKey).map((s) => `${done.has(s.key) ? "✅" : "▫️"} ${s.label} (+${s.bonus})`);
    const cards = pc.ALL.filter((c) => c.group.key === groupKey);
    const have = cards.filter((c) => owned.has(c.id));
    const total = have.reduce((s, c) => s + owned.get(c.id), 0);
    return new EmbedBuilder()
        .setColor(groupKey === "loona" ? loona.memberFor(member.id).color.hex : group.color)
        .setTitle(`${escapeMarkdown(member.displayName)}'s ${group.short} photocards`.slice(0, 256))
        .setDescription(`${rows.join("\n")}\n\n**Sets**\n${sets.join("\n")}${dupeList(owned, cards)}`.slice(0, 4096))
        .setFooter({ text: `${have.length}/${cards.length} cards · ${total} pulled · ${LEGEND}` });
}

/** Every group at a glance: cards owned, sets done, spares. */
function summaryEmbed(member, owned, groupKeys) {
    const done = new Set(pc.completedSets(owned.keys()).map((s) => s.key));
    const lines = groupKeys.map((k) => {
        const g = pc.GROUPS.get(k), cards = pc.ALL.filter((c) => c.group.key === k);
        const have = cards.filter((c) => owned.has(c.id)).length, sets = pc.SETS.filter((s) => s.group === k);
        return `**${g.short}** · ${have}/${cards.length} cards · ${sets.filter((s) => done.has(s.key)).length}/${sets.length} sets${spares(owned, cards).length ? ` · ${spares(owned, cards).length} with spares` : ""}`;
    });
    return new EmbedBuilder()
        .setColor(loona.memberFor(member.id).color.hex)
        .setTitle(`${escapeMarkdown(member.displayName)}'s photocards`.slice(0, 256))
        .setDescription(`${lines.join("\n")}\n\nSee one group with \`collection twice\` (or any group above).${dupeList(owned, pc.ALL)}`.slice(0, 4096))
        .setFooter({ text: `${owned.size}/${pc.ALL.length} cards · ${[...owned.values()].reduce((a, b) => a + b, 0)} pulled` });
}

module.exports = {
    name: "collection",
    description: "Shows someone's photocards: one group with \"collection twice\", or all of them.",
    aliases: ["cards", "binder"],
    options: [
        { name: "user", description: "Whose collection (leave empty for yours)", type: ApplicationCommandOptionType.User },
        { name: "group", description: "Just this group", type: ApplicationCommandOptionType.String },
    ],
    collectionEmbed,
    summaryEmbed,
    run: async (client, message, args) => {
        // A mention can come first ("collection @friend twice"); the rest names a group.
        const mention = args[0] && /^(?:<@!?)?\d{17,20}>?$/.test(args[0]) ? args[0] : null;
        const rest = mention ? args.slice(1) : args;
        const member = await targetMember(message, mention);
        if (!member) return message.reply("I couldn't find that member 🌙");
        const asked = rest.length ? pc.findGroup(rest.join(" ")) : null;
        if (rest.length && !asked) return message.reply(`I don't know that group. Try ${[...pc.GROUPS.values()].map((g) => `\`${g.key}\``).join(", ")} 🌙`);
        const owned = await db.photocardsOf(message.guild.id, member.id);
        if (!owned.size) {
            return message.reply(member.id === message.author.id
                ? "No photocards yet, Orbit. Your first `pull` today is free 🌙"
                : { content: `**${escapeMarkdown(member.displayName)}** has no photocards yet 🌙`, allowedMentions: { parse: [] } });
        }
        // Groups to show: the one asked for; else the server's groups plus any the person owns cards from.
        const ownedGroups = new Set([...owned.keys()].map((id) => pc.findCard(id)?.group.key).filter(Boolean));
        const keys = [...new Set([...pc.validGroups(await db.getCardGroups(message.guild.id)), ...ownedGroups])];
        const groupKey = asked?.key ?? (keys.length === 1 ? keys[0] : null);
        if (!groupKey) return message.reply({ embeds: [summaryEmbed(member, owned, keys)], allowedMentions: { parse: [], repliedUser: true } });
        const embed = collectionEmbed(member, owned, groupKey);
        // The binder picture is a nice extra: if drawing it fails, the list still shows.
        const binder = await pc.renderBinder(groupKey, owned).catch((err) => { console.error(`Binder failed: ${err.message}`); return null; });
        if (binder) embed.setImage("attachment://binder.png");
        return message.reply({ embeds: [embed], files: binder ? [new AttachmentBuilder(binder, { name: "binder.png" })] : [],
            allowedMentions: { parse: [], repliedUser: true } });
    },
};
