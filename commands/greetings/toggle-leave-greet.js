const { greetCommand } = require("../../lib/greetings/command");
const { updateGreetSettings, getGreetSettings } = require("../../lib/db");

module.exports = greetCommand({
    name: "toggle-leave-greet",
    description: 'Switches the leave greeting on or off.',
    aliases: [],
    run: async (client, message, args) => {
        const on = !(await getGreetSettings(message.guild.id)).leaveEnabled;
        await updateGreetSettings(message.guild.id, { leaveEnabled: on });
        return message.reply(`The leave greeting is now **${on ? "on" : "off"}**.`);
    }
});
