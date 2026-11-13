const client = require("../index");
const { getPrefix } = require("../lib/db");
const drops = require("../lib/loona/drops");

client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    drops.onMessage(message); // counts chat for photocard drops; never throws, and doesn't hold up commands

    // Per-guild prefix from -setprefix (the old code always used the default one)
    let prefix;
    try {
        prefix = await getPrefix(message.guild.id);
    } catch (err) {
        return console.error(`Couldn't load the prefix for guild ${message.guild.id}: ${err.message}`);
    }
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
