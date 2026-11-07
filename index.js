const { Client, Collection, EmbedBuilder, GatewayIntentBits, Events, Partials } = require("discord.js");
const { LavalinkManager } = require("lavalink-client");
const { TOKEN } = require('./config')
const config = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent, // privileged: enable it in the Developer Portal
        GatewayIntentBits.GuildMembers, // privileged ("Server Members Intent"): join/leave greetings
    ],
    partials: [Partials.GuildMember], // leave greetings still fire for members that weren't cached
    // Only real user mentions ping; track titles like "@everyone" in replies won't.
    allowedMentions: { parse: ["users"], repliedUser: true },
});
module.exports = client;

// Lavalink Connection and Events
client.lavalink = new LavalinkManager({
    nodes: [{
        id: "Main Node",
        host: config.host,
        port: config.port,
        authorization: config.password,
        retryDelay: 5000,
    }],
    sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard.send(payload),
    autoSkip: true,
    playerOptions: { defaultSearchPlatform: "ytsearch" },
});

client.lavalink.nodeManager
    .on("connect", node => console.log(`Node "${node.id}" has Connected.`))
    .on("error", (node, error) => console.log(`Node "${node.id}" encountered an error: ${error?.message ?? error}.`));

const botIcon = () => client.user.displayAvatarURL();
const sendTo = (player, embed) =>
    client.channels.cache.get(player.textChannelId)?.send({ embeds: [embed] }).catch(console.error);

client.lavalink
.on("trackStart", (player, track) => {
  sendTo(player, new EmbedBuilder()
    .setColor('#95E8A3')
    .setAuthor({ name: `Now Playing:`, iconURL: botIcon() })
    .setDescription(`[${track.info.title}](${track.info.uri})`)
    .addFields({ name: `Requested By: `, value: `${track.requester ?? 'Unknown'}`, inline: true }));
})
.on("trackStuck", (player, track) => {
  sendTo(player, new EmbedBuilder()
    .setColor('#95E8A3')
    .setAuthor({ name: `Track Stuck:`, iconURL: botIcon() })
    .setDescription(`${track?.info.title ?? 'Unknown track'}`));
})
.on("trackError", (player, track, payload) => {
  console.log(`Track error in ${player.guildId}: ${payload?.exception?.message}`);
})
.on("queueEnd", player => {
  sendTo(player, new EmbedBuilder()
    .setColor('#95E8A3')
    .setAuthor({ name: `Queue has ended`, iconURL: botIcon() }));
  // The bot stays in the call; events/voiceStateUpdate.js makes it leave after 3 minutes alone.
});

client.sendToPlayerChannel = sendTo;

client.once(Events.ClientReady, () => {
  client.lavalink.init({ id: client.user.id, username: client.user.username });
});

client.on("raw", d => client.lavalink.sendRawData(d));

// Keep the bot alive if a command throws somewhere we didn't catch.
process.on("unhandledRejection", err => console.error("Unhandled rejection:", err));

// Global Variables
client.commands = new Collection();

// Initializing the project
require("./handler")(client);

client.login(TOKEN).catch((err) => {
    const hint = err.code === "DisallowedIntents"
        ? "turn on Server Members Intent and Message Content Intent in the Developer Portal, under Bot"
        : "set DISCORD_TOKEN in .env";
    console.error(`Discord login failed: ${err.message} (${hint})`);
    process.exit(1);
});
