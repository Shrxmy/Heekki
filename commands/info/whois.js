const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const { targetMember } = require("../../lib/fun/target");
const { stamp } = require("../../lib/info/format");

module.exports = {
    name: "whois",
    description: 'Shows info about a member of this server.',
    aliases: ['userinfo', 'ui'],
    options: [{ name: 'user', description: 'Who (leave empty for yourself)', type: ApplicationCommandOptionType.User }],
    run: async (client, message, args) => {
        const member = await targetMember(message, args[0]);
        if (!member) return message.reply("I couldn't find that member.");
        const roles = [...member.roles.cache.values()].filter((r) => r.id !== message.guild.id && r.name !== "@everyone").sort((a, b) => b.position - a.position);
        const shown = roles.slice(0, 15).map((r) => `<@&${r.id}>`).join(" ");
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor(member.displayHexColor === "#000000" ? "#7632A0" : member.displayHexColor)
            .setTitle(member.displayName)
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: "Username", value: member.user.username, inline: true },
                { name: "ID", value: member.id, inline: true },
                { name: "Bot", value: member.user.bot ? "Yes" : "No", inline: true },
                { name: "Account created", value: stamp(member.user.createdAt) },
                { name: "Joined this server", value: member.joinedAt ? stamp(member.joinedAt) : "Unknown" },
                ...(member.premiumSince ? [{ name: "Boosting since", value: stamp(member.premiumSince) }] : []),
                { name: `Roles (${roles.length})`, value: (shown + (roles.length > 15 ? ` and ${roles.length - 15} more` : "")) || "None" },
            )] });
    }
};
