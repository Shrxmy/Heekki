const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const slots = require("../../lib/fun/slots");
const { getCoins, setCoins } = require("../../lib/db");

const DEFAULT_BET = 10, MAX_BET = 1000;

module.exports = {
    name: "slots",
    description: 'Spin the LOONA slot machine with moon coins (12 member animals + the moon jackpot).',
    aliases: ['slot'],
    options: [{ name: 'bet', description: `Moon coins to bet (default ${DEFAULT_BET}, max ${MAX_BET})`, type: ApplicationCommandOptionType.Integer, min_value: 1, max_value: MAX_BET }],
    run: async (client, message, args) => {
        const bet = args.length ? Number(args[0]) : DEFAULT_BET;
        if (!Number.isInteger(bet) || bet < 1 || bet > MAX_BET) return message.reply(`Bet a whole number of moon coins from 1 to ${MAX_BET}.`);

        // No await between reading and saving the balance, so two quick spins can't both spend the same coins.
        const balance = getCoins(message.guild.id, message.author.id);
        if (bet > balance) return message.reply(`You only have **${balance}** moon coins.`);
        const reels = slots.spin();
        const won = slots.payout(reels, bet);
        const after = balance - bet + won;
        setCoins(message.guild.id, message.author.id, after);

        const jackpot = reels.every((r) => r === slots.JACKPOT);
        const result = jackpot ? `Full moon jackpot! You won **${won}** moon coins.`
            : won ? `You won **${won}** moon coins.` : "No luck this time.";
        const embed = new EmbedBuilder()
            .setColor(won ? "#FFD700" : "#7B3FBF")
            .setTitle("LOONA Slots")
            .setDescription(`## ${reels.join("  ")}\n${result}`)
            .setFooter({ text: `Bet ${bet} · Balance ${after} moon coins · pair ×${slots.PAIR} · three ×${slots.TRIPLE} · three moons ×${slots.MOONS}` });
        return message.reply({ embeds: [embed] });
    }
};
