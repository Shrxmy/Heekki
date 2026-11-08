const { EmbedBuilder, version: djsVersion } = require("discord.js");
const { duration } = require("../../lib/info/format");

module.exports = {
    name: "stats",
    description: "Shows the bot's stats.",
    aliases: ['botinfo'],
    run: async (client, message, args) => {
        const users = [...client.guilds.cache.values()].reduce((sum, g) => sum + (g.memberCount ?? 0), 0);
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#7632A0")
            .setTitle("Heekki stats")
            .addFields(
                { name: "Servers", value: String(client.guilds.cache.size), inline: true },
                { name: "Members", value: String(users), inline: true },
                { name: "Commands", value: String(client.commands.size), inline: true },
                { name: "Music players", value: String(client.lavalink?.players?.size ?? 0), inline: true },
                { name: "Ping", value: `${client.ws.ping} ms`, inline: true },
                { name: "Uptime", value: duration(client.uptime ?? 0), inline: true },
                { name: "Memory", value: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`, inline: true },
                { name: "Versions", value: `Node ${process.version} · discord.js ${djsVersion}`, inline: true },
            )] });
    }
};
