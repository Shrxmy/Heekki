const client = require("../index");
const { getPrefix } = require("../db");

client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    // Per-guild prefix from -setprefix (the old code always used the default one)
    const prefix = getPrefix(message.guild.id);
    if (!message.content.toLowerCase().startsWith(prefix.toLowerCase())) return;

    const [cmd, ...args] = message.content
        .slice(prefix.length)
        .trim()
        .split(/ +/);

    const command = client.commands.get(cmd.toLowerCase()) || client.commands.find(c => c.aliases?.includes(cmd.toLowerCase()));

    if (!command) return;
    try {
        await command.run(client, message, args);
    } catch (err) {
        console.error(`Command "${command.name}" failed:`, err);
        message.reply(`Something went wrong: ${err.message}`).catch(() => {});
    }
});
