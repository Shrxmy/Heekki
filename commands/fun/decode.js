const { ApplicationCommandOptionType } = require("discord.js");
const { decode } = require("../../lib/fun/text");
const { quiet } = require("../../lib/fun/target");

module.exports = {
    name: "decode",
    description: 'Decodes binary or base64 text.',
    aliases: [],
    options: [{ name: 'text', description: 'Binary (01001100 ...) or base64 text', type: ApplicationCommandOptionType.String, max_length: 500, required: true }],
    run: async (client, message, args) => {
        const text = args.join(" ").trim();
        if (!text) return message.reply("Give me binary or base64 to decode, like `decode 01001100 01001111`.");
        const out = decode(text);
        if (!out) return message.reply("That doesn't look like binary or base64.");
        return message.reply(quiet(out));
    }
};
