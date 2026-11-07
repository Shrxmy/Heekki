const { ApplicationCommandOptionType } = require("discord.js");
const { flipText } = require("../../fun/text");
const { quiet } = require("../../fun/target");

module.exports = {
    name: "fliptext",
    description: 'Flips your text upside down.',
    aliases: ['upsidedown'],
    options: [{ name: 'text', description: 'The text to flip', type: ApplicationCommandOptionType.String, max_length: 500, required: true }],
    run: async (client, message, args) => {
        const text = args.join(" ").trim();
        if (!text) return message.reply("Give me some text, like `fliptext hello`.");
        return message.reply(quiet(flipText(text)));
    }
};
