const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const slots = require("../../lib/fun/slots");
const { getCoins, betCoins } = require("../../lib/db");

const DEFAULT_BET = 10, MAX_BET = 1000;
const PAYTABLE = `🌙 bet back · pair ×${slots.PAIR} · 🌙🌙 ×${slots.MOON_PAIR} · three ×${slots.TRIPLE} · 🌙🌙🌙 ×${slots.MOONS} · streaks ×2, ×${slots.STREAK_CAP}`;

/** The line for one spin's result. */
function result({ reels, won, streak }, bet) {
    if (!won) return "no luck";
    if (won === bet && streak === 0) return "🌙 bet back";
    const fire = streak > 1 ? ` 🔥 streak ×${Math.min(streak, slots.STREAK_CAP)}` : "";
    return `${reels.every((r) => r === slots.JACKPOT) ? "Full moon jackpot! " : ""}**+${won}**${fire}`;
}

module.exports = {
    name: "slots",
    description: `LOONA slot machine: up to ${slots.MAX_SPINS} spins in one go, and combos in a row build a streak.`,
    aliases: ["slot"],
    options: [
        { name: "spins", description: `How many spins (default 1, max ${slots.MAX_SPINS})`, type: ApplicationCommandOptionType.Integer, min_value: 1, max_value: slots.MAX_SPINS },
        { name: "bet", description: `Moon coins per spin (default ${DEFAULT_BET}, max ${MAX_BET})`, type: ApplicationCommandOptionType.Integer, min_value: 1, max_value: MAX_BET },
    ],
    run: async (client, message, args) => {
        const spins = args[0] === undefined ? 1 : Number(args[0]);
        const bet = args[1] === undefined ? DEFAULT_BET : Number(args[1]);
        if (!Number.isInteger(spins) || spins < 1 || spins > slots.MAX_SPINS) {
            return message.reply(`Spin 1 to ${slots.MAX_SPINS} times: \`slots 5\` is five spins, \`slots 5 50\` bets 50 on each.`);
        }
        if (!Number.isInteger(bet) || bet < 1 || bet > MAX_BET) return message.reply(`Bet a whole number of moon coins from 1 to ${MAX_BET}.`);

        // All the spins are paid for and settled in one database step, so a bet is never half taken.
        const results = slots.playSpins(spins, bet);
        const cost = spins * bet, won = results.reduce((sum, r) => sum + r.won, 0);
        const after = await betCoins(message.guild.id, message.author.id, cost, won);
        if (after === null) {
            return message.reply(`${spins === 1 ? "That spin costs" : `${spins} spins of ${bet} cost`} **${cost}** moon coins, and you have **${await getCoins(message.guild.id, message.author.id)}**.`);
        }

        const body = spins === 1
            ? `## ${results[0].reels.join("  ")}\n${result(results[0], bet)}`
            : results.map((r, i) => `\`${String(i + 1).padStart(2)}\` ${r.reels.join(" ")}  ${result(r, bet)}`).join("\n")
                + `\n\n${won >= cost ? `Up **${won - cost}**` : `Down **${cost - won}**`} moon coins over ${spins} spins.`;
        const embed = new EmbedBuilder()
            .setColor(won > cost ? "#FFD700" : "#7B3FBF")
            .setTitle("LOONA Slots")
            .setDescription(body)
            .setFooter({ text: `${spins > 1 ? `${spins} × ` : ""}bet ${bet} · Balance ${after} · ${PAYTABLE}` });
        return message.reply({ embeds: [embed] });
    },
};
