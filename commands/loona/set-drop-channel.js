const { ApplicationCommandOptionType, ChannelType, PermissionFlagsBits } = require("discord.js");
const db = require("../../lib/db");
const drops = require("../../lib/loona/drops");

const MANAGE = PermissionFlagsBits.ManageGuild;

module.exports = {
    name: "set-drop-channel",
    description: 'Sets where photocards drop during chat ("off" stops them, "test" drops one now).',
    aliases: ["dropchannel"],
    defaultMemberPermissions: MANAGE.toString(),
    options: [{ name: "channel_or_off", description: 'A text channel, "off", or "test"', type: ApplicationCommandOptionType.String, required: true }],
    run: async (client, message, args) => {
        if (!message.member.permissions.has(MANAGE)) return message.reply("You need the Manage Server permission to change photocard drops.");
        const arg = (args[0] ?? "").toLowerCase();
        if (arg === "off") {
            await db.setDropChannel(message.guild.id, null);
            drops.forget(message.guild.id);
            return message.reply("Photocard drops are off 🌙");
        }
        if (arg === "test") {
            const channelId = await db.getDropChannel(message.guild.id);
            const channel = channelId && message.guild.channels.cache.get(channelId);
            if (!channel) return message.reply("Set a drop channel first, e.g. `set-drop-channel #chat`.");
            message.reply(`Dropping a test card in <#${channel.id}> 🌙`).catch(() => {});
            return drops.drop(channel, message.guild.id);
        }
        const id = arg.match(/\d{17,20}/)?.[0];
        const channel = id && message.guild.channels.cache.get(id);
        if (!channel || channel.type !== ChannelType.GuildText) return message.reply("Mention a text channel, like `set-drop-channel #chat`, or use `off`.");
        if (!channel.permissionsFor(message.guild.members.me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles])) {
            return message.reply(`I need View Channel, Send Messages and Attach Files in <#${channel.id}> to drop cards there.`);
        }
        await db.setDropChannel(message.guild.id, channel.id);
        drops.forget(message.guild.id);
        return message.reply(`Photocards will drop in <#${channel.id}> after a burst of chat (at most one every 10 minutes). First to type \`catch\` wins 🌙`);
    },
};
