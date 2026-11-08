const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const { findRole, ensureMembers } = require("../../lib/info/resolve");

const SHOW = 40;

module.exports = {
    name: "rolememberinfo",
    description: 'Lists the members who have a role.',
    aliases: ['inrole', 'rolemembers'],
    options: [{ name: 'role', description: 'Which role', type: ApplicationCommandOptionType.Role, required: true }],
    run: async (client, message, args) => {
        const role = findRole(message.guild, args.join(" "));
        if (!role || role.id === message.guild.id) return message.reply("I couldn't find that role. Use its name or mention it.");
        const complete = await ensureMembers(message.guild);
        const names = [...role.members.values()].map((m) => m.displayName).sort((a, b) => a.localeCompare(b));
        const list = names.slice(0, SHOW).join(", ") + (names.length > SHOW ? `, and ${names.length - SHOW} more` : "");
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor(role.hexColor === "#000000" ? "#787A7D" : role.hexColor)
            .setTitle(`${role.name} (${names.length} member${names.length === 1 ? "" : "s"}${complete ? "" : ", may be incomplete"})`)
            .setDescription(list.slice(0, 4096) || "Nobody has this role.")] });
    }
};
