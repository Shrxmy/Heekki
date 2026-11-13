const { EmbedBuilder } = require("discord.js");
const { greetCommand, quiet } = require("../../lib/greetings/command");
const { getGreetSettings } = require("../../lib/db");

module.exports = greetCommand({
    name: "greet-settings",
    description: 'Shows the current greeting settings.',
    aliases: ['greetsettings'],
    run: async (client, message, args) => {
        const s = await getGreetSettings(message.guild.id);
        const embed = new EmbedBuilder()
            .setColor('#F4028E') // HeeJin pink, the Greetings colour in help
            .setTitle('Greeting settings')
            .addFields(
                { name: 'Channel', value: s.channelId ? `<#${s.channelId}>` : 'Not set (use `set-greet-channel`)' },
                { name: `Join greeting: ${s.joinEnabled ? 'on' : 'off'}`, value: s.joinMessage.slice(0, 1024) },
                { name: `Leave greeting: ${s.leaveEnabled ? 'on' : 'off'}`, value: s.leaveMessage.slice(0, 1024) },
                { name: `LOONA birthday posts: ${s.birthdayEnabled ? 'on' : 'off'}`, value: 'Each member\'s profile on her birthday (Korea time).' },
                { name: 'Background', value: s.hasBackground ? 'Custom image' : 'Night sky (default)', inline: true },
                { name: 'Member colours', value: s.colors.join(' '), inline: true },
            );
        return message.reply(quiet(undefined, { embeds: [embed] }));
    }
});
