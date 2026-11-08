const { EmbedBuilder, ChannelType } = require("discord.js");
const { stamp } = require("../../lib/info/format");

module.exports = {
    name: "serverinfo",
    description: 'Shows info about this server.',
    aliases: ['server', 'si'],
    run: async (client, message, args) => {
        const g = message.guild;
        const channels = [...g.channels.cache.values()];
        const count = (...types) => channels.filter((c) => types.includes(c.type)).length;
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#7632A0")
            .setTitle(g.name)
            .setThumbnail(g.iconURL({ size: 256 }))
            .setImage(g.bannerURL({ size: 1024 }))
            .addFields(
                { name: "Owner", value: `<@${g.ownerId}>`, inline: true },
                { name: "Members", value: String(g.memberCount), inline: true },
                { name: "Boosts", value: `Level ${g.premiumTier} · ${g.premiumSubscriptionCount ?? 0} boosts`, inline: true },
                { name: "Channels", value: `${count(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)} text · ${count(ChannelType.GuildVoice, ChannelType.GuildStageVoice)} voice`, inline: true },
                { name: "Roles", value: String(g.roles.cache.size - 1), inline: true },
                { name: "Emojis", value: String(g.emojis.cache.size), inline: true },
                { name: "Created", value: stamp(g.createdAt) },
            )
            .setFooter({ text: `ID ${g.id}` })] });
    }
};
