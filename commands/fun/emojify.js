const { ApplicationCommandOptionType } = require("discord.js");
const { emojify } = require("../../lib/fun/text");
const { quiet } = require("../../lib/fun/target");

module.exports = {
    name: "emojify",
    description: 'Turns your text into big emoji letters.',
    aliases: [],
    options: [{ name: 'text', description: 'The text to emojify', type: ApplicationCommandOptionType.String, max_length: 500, required: true }],
    run: async (client, message, args) => {
        const text = args.join(" ").trim();
        if (!text) return message.reply("Give me some text, like `emojify hello`.");
        return message.reply(quiet(emojify(text)));
    }
};
