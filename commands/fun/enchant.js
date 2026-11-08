const { ApplicationCommandOptionType } = require("discord.js");
const { enchant } = require("../../lib/fun/text");
const { quiet } = require("../../lib/fun/target");

module.exports = {
    name: "enchant",
    description: 'Writes your text in Minecraft enchanting-table letters.',
    aliases: [],
    options: [{ name: 'text', description: 'The text to enchant', type: ApplicationCommandOptionType.String, max_length: 500, required: true }],
    run: async (client, message, args) => {
        const text = args.join(" ").trim();
        if (!text) return message.reply("Give me some text, like `enchant hello`.");
        return message.reply(quiet(enchant(text)));
    }
};
