const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const { targetMember, quiet } = require("../../lib/fun/target");

module.exports = {
    name: "userbanner",
    description: "Shows someone's profile banner.",
    aliases: ['banner'],
    options: [{ name: 'user', description: 'Who (leave empty for yourself)', type: ApplicationCommandOptionType.User }],
    run: async (client, message, args) => {
        const member = await targetMember(message, args[0]);
        if (!member) return message.reply("I couldn't find that member.");
        const user = await client.users.fetch(member.id, { force: true }).catch(() => null); // banners only come with a fresh fetch
        const banner = user?.bannerURL?.({ size: 1024 });
        if (!banner) return message.reply(quiet(`**${member.displayName}** doesn't have a banner.`));
        return message.reply({ embeds: [new EmbedBuilder().setColor("#F4028E").setTitle(`${member.displayName}'s banner`).setImage(banner)] });
    }
};
