const { ApplicationCommandOptionType } = require("discord.js");
const { zalgo } = require("../../fun/text");
const { quiet } = require("../../fun/target");

module.exports = {
    name: "zalgo",
    description: 'Makes your text look cursed.',
    aliases: ['cursed'],
    options: [{ name: 'text', description: 'The text to curse', type: ApplicationCommandOptionType.String, max_length: 500, required: true }],
    run: async (client, message, args) => {
        const text = args.join(" ").trim();
        if (!text) return message.reply("Give me some text, like `zalgo hello`.");
        return message.reply(quiet(zalgo(text)));
    }
};
