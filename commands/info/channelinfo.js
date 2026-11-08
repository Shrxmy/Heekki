const { ApplicationCommandOptionType, EmbedBuilder, ChannelType } = require("discord.js");
const { findChannel } = require("../../lib/info/resolve");
const { stamp, truncate } = require("../../lib/info/format");

const TYPES = { [ChannelType.GuildText]: "Text", [ChannelType.GuildVoice]: "Voice", [ChannelType.GuildCategory]: "Category",
    [ChannelType.GuildAnnouncement]: "Announcement", [ChannelType.GuildStageVoice]: "Stage", [ChannelType.GuildForum]: "Forum" };
const VOICE = [ChannelType.GuildVoice, ChannelType.GuildStageVoice];

module.exports = {
    name: "channelinfo",
    description: 'Shows info about a channel (this one by default).',
    aliases: ['ci'],
    options: [{ name: 'channel', description: 'Which channel (leave empty for this one)', type: ApplicationCommandOptionType.Channel }],
    run: async (client, message, args) => {
        const channel = args.length ? findChannel(message.guild, args.join(" ")) : message.guild.channels.cache.get(message.channel.id);
        if (!channel) return message.reply("I couldn't find that channel.");
        const fields = [
            { name: "Type", value: TYPES[channel.type] ?? "Other", inline: true },
            { name: "Category", value: channel.parent?.name ?? "None", inline: true },
            { name: "ID", value: channel.id, inline: true },
        ];
        if (VOICE.includes(channel.type)) {
            fields.push({ name: "Bitrate", value: `${Math.round(channel.bitrate / 1000)} kbps`, inline: true },
                { name: "User limit", value: channel.userLimit ? String(channel.userLimit) : "None", inline: true });
        } else {
            fields.push({ name: "Age-restricted", value: channel.nsfw ? "Yes" : "No", inline: true },
                { name: "Slowmode", value: channel.rateLimitPerUser ? `${channel.rateLimitPerUser}s` : "Off", inline: true });
            if (channel.topic) fields.push({ name: "Topic", value: truncate(channel.topic, 1024) });
        }
        fields.push({ name: "Created", value: stamp(channel.createdAt) });
        return message.reply({ embeds: [new EmbedBuilder().setColor("#01954A").setTitle(`${VOICE.includes(channel.type) ? "" : "#"}${channel.name}`).addFields(fields)] });
    }
};
