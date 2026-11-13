// Posts a LOONA member's profile in each server's greeting channel on her birthday (Korea time).
const { PermissionFlagsBits } = require("discord.js");
const loona = require(".");
const { getGreetSettings, claimBirthdayPost, unclaimBirthdayPost } = require("../db");
const { memberEmbed } = require("../../commands/loona/loona");

const NEEDED = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
const CHECK_EVERY = 60 * 60 * 1000; // hourly, so a post lands within an hour of midnight in Korea

const birthdaysToday = (now = new Date()) => loona.members.filter((m) => loona.daysUntilBirthday(m, now) === 0);

const birthdayMessage = (member, now = new Date()) => ({
    content: `🎂 Happy birthday, **${member.name}**! She turns ${loona.age(member, now)} today. 🌙`,
    embeds: [memberEmbed(member, { fact: Math.floor(Math.random() * member.facts.length), now })],
    allowedMentions: { parse: [] },
});

/** The channel this server's birthday posts go to, or null if they're off or can't be posted. */
async function birthdayChannel(guild) {
    const settings = await getGreetSettings(guild.id);
    if (!settings.birthdayEnabled || !settings.channelId) return null;
    const channel = guild.channels.cache.get(settings.channelId);
    return channel?.permissionsFor(guild.members.me)?.has(NEEDED) ? channel : null;
}

/** Posts today's birthdays in every server that hasn't had them yet. Never throws. */
async function postBirthdays(client, now = new Date()) {
    const today = birthdaysToday(now);
    if (!today.length) return;
    const { y } = loona.koreaDate(now);
    for (const guild of client.guilds.cache.values()) {
        const channel = await birthdayChannel(guild).catch((err) => console.error(`Birthday check failed in guild ${guild.id}: ${err.message}`));
        if (!channel) continue;
        for (const member of today) {
            // shortcut: a crash mid-send skips that post for the year, and a failure in the last hour of her day isn't retried after midnight; add a pending/delivered state if that ever matters.
            if (!await claimBirthdayPost(guild.id, member.key, y)) continue;
            try {
                await channel.send(birthdayMessage(member, now));
            } catch (err) {
                await unclaimBirthdayPost(guild.id, member.key, y).catch(() => {});
                console.error(`Birthday post for ${member.name} failed in guild ${guild.id}: ${err.message}`);
            }
        }
    }
}

function startBirthdayPosts(client) {
    const run = () => postBirthdays(client).catch(console.error);
    run();
    setInterval(run, CHECK_EVERY);
}

module.exports = { birthdaysToday, birthdayMessage, birthdayChannel, postBirthdays, startBirthdayPosts };
