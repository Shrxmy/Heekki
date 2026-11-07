module.exports = {
    name: "ping",
    description: 'Shows the bot\'s websocket ping.',
    aliases: ['p'],
    run: async (client, message, args) => {
        message.channel.send(`${client.ws.ping} ws ping`);
    },
};
