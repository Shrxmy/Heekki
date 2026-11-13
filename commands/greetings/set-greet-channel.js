const { ApplicationCommandOptionType, ChannelType } = require("discord.js");
const { greetCommand } = require("../../lib/greetings/command");
const { updateGreetSettings } = require("../../lib/db");

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

module.exports = greetCommand({
    name: "set-greet-channel",
    description: 'Sets the channel where welcome and leave greetings are posted.',
    aliases: ['greetchannel'],
    options: [{ name: 'channel', description: 'The text channel for greetings', type: ApplicationCommandOptionType.Channel, channel_types: TEXT_TYPES, required: true }],
    run: async (client, message, args) => {
        const id = args[0]?.replace(/^<#|>$/g, ""); // "#welcome" mention (<#id>) or a plain channel ID
        const channel = id && message.guild.channels.cache.get(id);
        if (!channel || !TEXT_TYPES.includes(channel.type))
            return message.reply("Pick a text channel in this server, like `set-greet-channel #welcome`.");
        await updateGreetSettings(message.guild.id, { channelId: channel.id });
        return message.reply(`Greetings will be posted in <#${channel.id}>.`);
    }
});
