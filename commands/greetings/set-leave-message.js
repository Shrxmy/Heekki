const { ApplicationCommandOptionType } = require("discord.js");
const { greetCommand, quiet, isReset } = require("../../greetings/command");
const { updateGreetSettings, getGreetSettings } = require("../../db");
const { MAX_MESSAGE_LENGTH } = require("../../greetings/format");

module.exports = greetCommand({
    name: "set-leave-message",
    description: 'Sets the leave greeting text. Placeholders: {user} {username} {server} {count}',
    aliases: [],
    options: [{ name: 'message', description: 'The text, or "reset" for the default', type: ApplicationCommandOptionType.String, max_length: MAX_MESSAGE_LENGTH, required: true }],
    run: async (client, message, args) => {
        const text = args.join(" ").trim();
        if (!text) return message.reply("Write the message, like `set-leave-message Welcome to the Orbit, {user}!`");
        if (text.length > MAX_MESSAGE_LENGTH) return message.reply(`That's too long: keep it under ${MAX_MESSAGE_LENGTH} characters.`);
        updateGreetSettings(message.guild.id, { leaveMessage: isReset(args) ? null : text });
        const saved = getGreetSettings(message.guild.id).leaveMessage;
        return message.reply(quiet(`Saved the leave message:\n> ${saved}\nPlaceholders: \`{user}\` \`{username}\` \`{server}\` \`{count}\`. Try it with \`testleave\`.`));
    }
});
