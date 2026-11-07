module.exports = {
    name: "coinflip",
    description: 'Flip a coin.',
    aliases: ['flip', 'coin'],
    run: async (client, message, args) => {
        return message.reply(Math.random() < 0.5 ? "🪙 **Heads!**" : "🪙 **Tails!**");
    }
};
