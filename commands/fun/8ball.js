const { ApplicationCommandOptionType } = require("discord.js");

const ANSWERS = [
    "Yes, definitely. ✅", "Without a doubt.", "Most likely.", "Signs point to yes.", "Sure, why not.",
    "Ask again later. 🔮", "Hard to say right now.", "Better not tell you now.", "Concentrate and ask again.",
    "Don't count on it.", "My sources say no.", "Very doubtful.", "Nope. ❌", "Absolutely not.",
];

module.exports = {
    name: "8ball",
    description: 'Ask the magic 8-ball a yes/no question.',
    aliases: ['eightball'],
    options: [{ name: 'question', description: 'Your yes/no question', type: ApplicationCommandOptionType.String, required: true }],
    run: async (client, message, args) => {
        const question = args.join(" ");
        if (!question) return message.reply("Ask me a question, like `8ball will it rain tomorrow?`");
        const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
        // Echoed text is untrusted: don't let it ping anyone.
        return message.reply({ content: `🎱 **${question.slice(0, 200)}**\n${answer}`, allowedMentions: { parse: [], repliedUser: true } });
    }
};
