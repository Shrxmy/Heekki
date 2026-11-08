const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const { stamp } = require("../../lib/info/format");

module.exports = {
    name: "globalwhois",
    description: 'Shows info about any Discord user by ID, even outside this server.',
    aliases: ['gwhois'],
    options: [{ name: 'user', description: 'User ID or mention', type: ApplicationCommandOptionType.User, required: true }],
    run: async (client, message, args) => {
        const id = args[0]?.match(/\d{17,20}/)?.[0];
        if (!id) return message.reply("Give me a user ID or mention, like `globalwhois 123456789012345678`.");
        const user = await client.users.fetch(id, { force: true }).catch(() => null);
        if (!user) return message.reply("I couldn't find a Discord user with that ID.");
        const banner = user.bannerURL?.({ size: 1024 });
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#7632A0")
            .setTitle(user.globalName ? `${user.globalName} (${user.username})` : user.username)
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .setImage(banner ?? null)
            .addFields(
                { name: "ID", value: user.id, inline: true },
                { name: "Bot", value: user.bot ? "Yes" : "No", inline: true },
                { name: "Account created", value: stamp(user.createdAt) },
            )] });
    }
};
