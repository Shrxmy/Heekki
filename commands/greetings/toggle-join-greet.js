const { greetCommand } = require("../../greetings/command");
const { updateGreetSettings, getGreetSettings } = require("../../db");

module.exports = greetCommand({
    name: "toggle-join-greet",
    description: 'Switches the join greeting on or off.',
    aliases: [],
    run: async (client, message, args) => {
        const on = !getGreetSettings(message.guild.id).joinEnabled;
        updateGreetSettings(message.guild.id, { joinEnabled: on });
        return message.reply(`The join greeting is now **${on ? "on" : "off"}**.`);
    }
});
