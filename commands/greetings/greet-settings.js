const { EmbedBuilder } = require("discord.js");
const { greetCommand, quiet } = require("../../lib/greetings/command");
const { getGreetSettings } = require("../../lib/db");

module.exports = greetCommand({
    name: "greet-settings",
    description: 'Shows the current greeting settings.',
    aliases: ['greetsettings'],
    run: async (client, message, args) => {
        const s = getGreetSettings(message.guild.id);
        const embed = new EmbedBuilder()
            .setColor('#95E8A3')
            .setTitle('Greeting settings')
            .addFields(
                { name: 'Channel', value: s.channelId ? `<#${s.channelId}>` : 'Not set (use `set-greet-channel`)' },
                { name: `Join greeting: ${s.joinEnabled ? 'on' : 'off'}`, value: s.joinMessage.slice(0, 1024) },
                { name: `Leave greeting: ${s.leaveEnabled ? 'on' : 'off'}`, value: s.leaveMessage.slice(0, 1024) },
                { name: 'Background', value: s.background ? 'Custom image' : 'Night sky (default)', inline: true },
                { name: 'Star colours', value: s.colors.join(' '), inline: true },
            );
        return message.reply(quiet(undefined, { embeds: [embed] }));
    }
});
