const { ApplicationCommandOptionType, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    name: "invites",
    description: 'Who invited the most people (or how many someone invited).',
    aliases: [],
    options: [{ name: 'user', description: 'Whose invites (leave empty for the leaderboard)', type: ApplicationCommandOptionType.User }],
    run: async (client, message, args) => {
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild))
            return message.reply("I need the Manage Server permission to see this server's invites.");
        const invites = await message.guild.invites.fetch().catch(() => null);
        if (!invites) return message.reply("I couldn't load the invites right now.");

        const totals = new Map(); // inviter id -> { user, uses }
        for (const invite of invites.values()) {
            if (!invite.inviter) continue;
            const entry = totals.get(invite.inviter.id) ?? { user: invite.inviter, uses: 0 };
            entry.uses += invite.uses ?? 0;
            totals.set(invite.inviter.id, entry);
        }
        const id = args[0]?.match(/\d{17,20}/)?.[0];
        if (id) {
            const entry = totals.get(id);
            return message.reply({ content: `<@${id}> has invited **${entry?.uses ?? 0}** people with their active invites.`, allowedMentions: { parse: [] } });
        }
        const top = [...totals.values()].sort((a, b) => b.uses - a.uses).slice(0, 10);
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#FFCB07")
            .setTitle("Invite leaderboard")
            .setDescription(top.map((e, i) => `**${i + 1}.** ${e.user.globalName ?? e.user.username}: ${e.uses}`).join("\n") || "No invites have been used yet.")
            .setFooter({ text: "Counts uses of invites that still exist" })] });
    }
};
