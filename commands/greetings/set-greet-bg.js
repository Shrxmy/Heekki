const { ApplicationCommandOptionType } = require("discord.js");
const { greetCommand, isReset } = require("../../lib/greetings/command");
const { updateGreetSettings, getGreetSettings } = require("../../lib/db");
const { downloadBackground } = require("../../lib/greetings/background");
const { buildGreeting } = require("../../lib/greetings/post");

module.exports = greetCommand({
    name: "set-greet-bg",
    description: 'Sets the greeting card background from an uploaded image (or "reset").',
    aliases: ['greetbg'],
    options: [
        { name: 'image', description: 'Upload a PNG, JPEG or WebP (up to 8 MB)', type: ApplicationCommandOptionType.Attachment },
        { name: 'link_or_reset', description: 'A Discord image link, or "reset" for the night sky', type: ApplicationCommandOptionType.String },
    ],
    run: async (client, message, args) => {
        if (isReset(args)) {
            updateGreetSettings(message.guild.id, { background: null });
            return message.reply("Background is back to the night sky.");
        }
        const url = message.attachments?.first()?.url ?? args[0];
        if (!url) return message.reply("Upload an image with the command (or paste a Discord image link), or use `reset`.");

        let background;
        try {
            background = await downloadBackground(url);
        } catch (err) {
            return message.reply(err.message);
        }
        updateGreetSettings(message.guild.id, { background });
        try {
            const preview = await buildGreeting(message.member, "join", getGreetSettings(message.guild.id));
            return await message.reply({ ...preview, content: "Background saved. Here's how it looks:", allowedMentions: { parse: [] } });
        } catch (err) {
            return message.reply(`Background saved, but I couldn't show a preview here: ${err.message}`);
        }
    }
});
