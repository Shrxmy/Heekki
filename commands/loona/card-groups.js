const { ApplicationCommandOptionType, PermissionFlagsBits } = require("discord.js");
const pc = require("../../lib/loona/photocards");
const db = require("../../lib/db");

const MANAGE = PermissionFlagsBits.ManageGuild;
const list = (keys) => keys.map((k) => `**${pc.GROUPS.get(k).short}** (${pc.GROUPS.get(k).members.length})`).join(", ");

/** Group keys named in args ("loona, twice aespa", "tomorrow x together"), plus any words that aren't a group. */
function groupsFrom(args) {
    const keys = [], unknown = [];
    for (const part of args.join(" ").split(",").map((p) => p.trim()).filter(Boolean)) {
        const whole = pc.findGroup(part);
        if (whole) { keys.push(whole.key); continue; }
        for (const word of part.split(/\s+/)) {
            const g = pc.findGroup(word);
            if (g) keys.push(g.key); else unknown.push(word);
        }
    }
    return { keys: [...new Set(keys)], unknown };
}

module.exports = {
    name: "card-groups",
    description: 'Which groups\' photocards this server pulls, e.g. "card-groups loona twice aespa", "all" or "reset".',
    aliases: ["set-card-groups", "cardgroups"],
    options: [{ name: "groups", description: 'Groups to use (leave empty to see them), "all", or "reset" for LOONA only', type: ApplicationCommandOptionType.String }],
    groupsFrom,
    run: async (client, message, args) => {
        const all = [...pc.GROUPS.keys()];
        if (!args.length) {
            const on = pc.validGroups(await db.getCardGroups(message.guild.id));
            return message.reply(`Photocards here come from ${list(on)}.\nAvailable: ${list(all)}.\nAdmins can change it with \`card-groups loona twice\`, \`card-groups all\` or \`card-groups reset\`.`);
        }
        if (!message.member.permissions.has(MANAGE)) return message.reply("You need the Manage Server permission to change the card groups.");
        const word = args.join(" ").toLowerCase();
        if (word === "reset") {
            await db.setCardGroups(message.guild.id, null);
            return message.reply("Back to **LOONA** photocards only 🌙");
        }
        const { keys, unknown } = word === "all" ? { keys: all, unknown: [] } : groupsFrom(args);
        if (unknown.length || !keys.length) return message.reply(`I don't know ${unknown.length ? `"${unknown.join(" ").slice(0, 40)}"` : "those groups"}. Available: ${list(all)}.`);
        await db.setCardGroups(message.guild.id, keys);
        return message.reply(`Pulls and drops here now use ${list(keys)} photocards 🌙`);
    },
};
