const { ApplicationCommandOptionType } = require("discord.js");
const { greetCommand, isReset } = require("../../lib/greetings/command");
const { updateGreetSettings } = require("../../lib/db");
const { parseColors } = require("../../lib/greetings/format");

module.exports = greetCommand({
    name: "set-greet-colors",
    description: 'Sets the 12 star colours on the greeting card (or "reset" for the LOONA colours).',
    aliases: ['greetcolors'],
    options: [{ name: 'colors', description: '12 hex colours separated by spaces, or "reset"', type: ApplicationCommandOptionType.String, required: true }],
    run: async (client, message, args) => {
        if (isReset(args)) {
            updateGreetSettings(message.guild.id, { colors: null });
            return message.reply("Star colours are back to the LOONA member colours.");
        }
        const colors = parseColors(args.join(" "));
        if (!colors) return message.reply("Give exactly 12 hex colours separated by spaces, like `#FF0092 #FFD700 ...` (or `reset`).");
        updateGreetSettings(message.guild.id, { colors });
        return message.reply(`Saved the star colours: ${colors.join(" ")}`);
    }
});
