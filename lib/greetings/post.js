// Builds and sends the join/leave greeting: the message text plus the "Who's Next Girl?" card.
const { AttachmentBuilder, PermissionFlagsBits } = require("discord.js");
const { getGreetSettings, getGreetBackground } = require("../db");
const { fillPlaceholders, cardLine } = require("./format");
const { renderCard } = require("./card");

const NEEDED = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles];

/** @param {"join"|"leave"} kind */
async function buildGreeting(member, kind, settings) {
    const template = kind === "join" ? settings.joinMessage : settings.leaveMessage;
    const vars = {
        mention: `<@${member.id}>`,
        username: member.displayName,
        server: member.guild.name,
        count: member.guild.memberCount,
    };
    const png = await renderCard({
        avatarURL: member.displayAvatarURL({ extension: "png", size: 256 }),
        displayName: member.displayName,
        count: vars.count,
        line: cardLine(template, vars),
        colors: settings.colors,
        background: settings.hasBackground ? await getGreetBackground(member.guild.id) : null,
    });
    return {
        content: fillPlaceholders(template, vars),
        files: [new AttachmentBuilder(png, { name: "welcome.png" })],
        // Only the new member may be pinged, whatever the admin typed (no @everyone, roles or other users).
        allowedMentions: { users: kind === "join" ? [member.id] : [] },
    };
}

/** Empty when the real greeting would post; otherwise the reasons it won't. */
function greetingProblems(guild, settings, kind) {
    const problems = [];
    const enabled = kind === "join" ? settings.joinEnabled : settings.leaveEnabled;
    if (!enabled) problems.push(`The ${kind} greeting is switched off.`);
    if (!settings.channelId) return [`No greeting channel is set (use set-greet-channel).`, ...problems];

    const channel = guild.channels.cache.get(settings.channelId);
    if (!channel) return ["The greeting channel no longer exists.", ...problems];
    if (!channel.permissionsFor(guild.members.me)?.has(NEEDED))
        problems.push(`I'm missing View Channel / Send Messages / Attach Files in <#${channel.id}>.`);
    return problems;
}

/** Posts the real greeting. Never throws: problems are skipped quietly, failures are logged once. */
async function sendGreeting(member, kind) {
    try {
        if (member.user?.bot) return;
        const settings = await getGreetSettings(member.guild.id);
        if (greetingProblems(member.guild, settings, kind).length) return;
        const channel = member.guild.channels.cache.get(settings.channelId);
        await channel.send(await buildGreeting(member, kind, settings));
    } catch (err) {
        console.error(`Greeting (${kind}) failed in guild ${member.guild?.id}: ${err.message}`);
    }
}

/** testjoin/testleave: preview in the current channel, then say what (if anything) stops the real greeting. */
async function previewGreeting(message, kind) {
    const settings = await getGreetSettings(message.guild.id);
    const lines = [];
    try {
        await message.reply(await buildGreeting(message.member, kind, settings));
    } catch (err) {
        lines.push(`I couldn't post the preview here: ${err.message}`); // e.g. no Attach Files in this channel
    }
    const problems = greetingProblems(message.guild, settings, kind);
    if (problems.length) lines.push(`⚠️ The real greeting won't post yet: ${problems.join(" ")}`);
    if (lines.length) return message.channel.send(lines.join("\n"));
}

module.exports = { buildGreeting, greetingProblems, sendGreeting, previewGreeting };
