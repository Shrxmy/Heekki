const { EmbedBuilder } = require("discord.js");
const { recall } = require("../../lib/fun/snipes");

module.exports = {
    name: "snipe",
    description: 'Shows the last deleted message in this channel (from the last 15 minutes).',
    aliases: [],
    run: async (client, message, args) => {
        const snipe = recall("deleted", message.channel.id);
        if (!snipe) return message.reply("There's nothing to snipe here.");
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#C0C0C0")
            .setAuthor({ name: snipe.authorTag, iconURL: snipe.authorAvatar || undefined })
            .setDescription(snipe.content.slice(0, 4096))
            .setFooter({ text: "Deleted" })
            .setTimestamp(snipe.at)] });
    }
};
