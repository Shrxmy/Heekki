const { ApplicationCommandOptionType, PermissionFlagsBits } = require("discord.js");
const pc = require("../../lib/loona/photocards");
const db = require("../../lib/db");

/** "HeeJin bias", "TWICE Nayeon bias": the role for a member, in their colour. */
const roleName = (member) => `${pc.fullName(member)} bias`.slice(0, 100);
const ROLE_NAMES = new Set([...pc.GROUPS.values()].flatMap((g) => g.members.map(roleName)));

module.exports = {
    name: "bias",
    description: 'Wear your bias as a role in their colour: "bias heejin", "bias twice nayeon", or "bias none".',
    aliases: ["setbias"],
    options: [{ name: "member", description: 'Who, like "heejin" or "twice nayeon"; "none" takes the role off', type: ApplicationCommandOptionType.String, required: true }],
    roleName,
    run: async (client, message, args) => {
        const query = args.join(" ").trim();
        if (!query) return message.reply("Who's your bias? Try `bias heejin` or `bias twice nayeon` 🌙");
        const none = ["none", "off", "remove", "clear"].includes(query.toLowerCase());
        const member = none ? null : pc.findAnyMember(query);
        if (!none && !member) return message.reply("I don't know that member. Try `bias heejin` or `bias twice nayeon` 🌙");
        // Only the server's card groups, so nobody can fill the server with roles for groups it doesn't use.
        const groups = pc.validGroups(await db.getCardGroups(message.guild.id));
        if (member && !groups.includes(member.group)) {
            return message.reply(`**${pc.GROUPS.get(member.group).short}** isn't one of this server's card groups. An admin can add it with \`card-groups\` 🌙`);
        }
        if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply("I need the **Manage Roles** permission to give bias roles. Ask an admin 🌙");
        }
        const you = await message.guild.members.fetch(message.author.id);
        const old = you.roles.cache.filter((r) => ROLE_NAMES.has(r.name) && r.name !== (member && roleName(member)));
        try {
            let role = null;
            if (member) {
                role = message.guild.roles.cache.find((r) => r.name === roleName(member))
                    ?? await message.guild.roles.create({ name: roleName(member), colors: { primaryColor: member.color.hex }, permissions: [], mentionable: false,
                        reason: `Bias role, asked for by ${message.author.username}` });
            }
            if (old.size) await you.roles.remove([...old.values()], "Changed bias");
            if (role && !you.roles.cache.has(role.id)) await you.roles.add(role, "Picked a bias");
            return message.reply({ content: role ? `💜 You're wearing <@&${role.id}> now.` : old.size ? "Took your bias role off 🌙" : "You don't have a bias role 🌙",
                allowedMentions: { parse: [] } });
        } catch (err) {
            return message.reply(`I couldn't change your roles (${err.message}). My role may need to be higher than the bias roles 🌙`);
        }
    },
};
