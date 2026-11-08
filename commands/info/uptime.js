const { duration } = require("../../lib/info/format");

module.exports = {
    name: "uptime",
    description: 'How long the bot has been online.',
    aliases: [],
    run: async (client, message, args) => {
        const since = Math.floor((Date.now() - (client.uptime ?? 0)) / 1000);
        return message.reply(`I've been online for **${duration(client.uptime ?? 0)}** (since <t:${since}:f>).`);
    }
};
