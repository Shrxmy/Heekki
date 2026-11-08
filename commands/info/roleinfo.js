const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const { findRole, ensureMembers } = require("../../lib/info/resolve");
const { stamp, truncate } = require("../../lib/info/format");

module.exports = {
    name: "roleinfo",
    description: 'Shows info about a role.',
    aliases: ['ri'],
    options: [{ name: 'role', description: 'Which role', type: ApplicationCommandOptionType.Role, required: true }],
    run: async (client, message, args) => {
        const role = findRole(message.guild, args.join(" "));
        if (!role || role.id === message.guild.id) return message.reply("I couldn't find that role. Use its name or mention it.");
        const complete = await ensureMembers(message.guild);
        const perms = role.permissions.toArray();
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor(role.hexColor === "#000000" ? "#787A7D" : role.hexColor)
            .setTitle(role.name)
            .addFields(
                { name: "Members", value: `${role.members.size}${complete ? "" : " (may be incomplete)"}`, inline: true },
                { name: "Colour", value: role.hexColor, inline: true },
                { name: "Position", value: String(role.position), inline: true },
                { name: "Shown separately", value: role.hoist ? "Yes" : "No", inline: true },
                { name: "Mentionable", value: role.mentionable ? "Yes" : "No", inline: true },
                { name: "Managed by an app", value: role.managed ? "Yes" : "No", inline: true },
                { name: "Created", value: stamp(role.createdAt) },
                { name: `Permissions (${perms.length})`, value: truncate(perms.join(", ") || "None", 1024) },
            )
            .setFooter({ text: `ID ${role.id}` })] });
    }
};
