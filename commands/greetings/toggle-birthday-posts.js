const { greetCommand } = require("../../lib/greetings/command");
const { updateGreetSettings, getGreetSettings } = require("../../lib/db");

module.exports = greetCommand({
    name: "toggle-birthday-posts",
    description: 'Switches LOONA member birthday posts in the greeting channel on or off.',
    aliases: ['togglebirthdays'],
    run: async (client, message, args) => {
        const on = !(await getGreetSettings(message.guild.id)).birthdayEnabled;
        await updateGreetSettings(message.guild.id, { birthdayEnabled: on });
        return message.reply(`LOONA birthday posts are now **${on ? "on" : "off"}**.`);
    }
});
