const { Events } = require("discord.js");
const { musicEmbed } = require("../lib/music/embed");
const client = require("../index");

// Leave once nobody (bots don't count) has been in the bot's voice channel for this long.
const ALONE_LEAVE_MS = 3 * 60_000;
const aloneTimers = new Map();

const stopAloneTimer = (guildId) => {
    clearTimeout(aloneTimers.get(guildId));
    aloneTimers.delete(guildId);
};

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const guild = newState.guild;
    const player = client.lavalink.getPlayer(guild.id);
    if (!player) return stopAloneTimer(guild.id);

    const listeners = guild.channels.cache.get(player.voiceChannelId)?.members.filter((m) => !m.user.bot).size ?? 0;
    if (listeners > 0) return stopAloneTimer(guild.id);
    if (aloneTimers.has(guild.id)) return;

    aloneTimers.set(guild.id, setTimeout(() => {
        aloneTimers.delete(guild.id);
        const current = client.lavalink.getPlayer(guild.id);
        if (!current) return;
        current.destroy()
            .then(() => client.sendToPlayerChannel(current, musicEmbed()
                .setAuthor({ name: "🌙 Nobody was listening, so I left the voice channel. Bye, Orbit!" })))
            .catch((err) => console.error(`Couldn't leave voice in ${guild.id}:`, err));
    }, ALONE_LEAVE_MS));
});

// -stop, or anything else that ends the player, cancels a pending leave.
client.lavalink.on("playerDestroy", (player) => stopAloneTimer(player.guildId));

module.exports = { ALONE_LEAVE_MS, aloneTimers };
