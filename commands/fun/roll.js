const { ApplicationCommandOptionType } = require("discord.js");

// Accepts "20" (one d20), "d20", or "2d6". Returns null for anything else or out-of-range dice.
function parseDice(text = "1d6") {
    const match = /^(?:(\d{1,2})?d)?(\d{1,4})$/i.exec(text.trim());
    if (!match) return null;
    const count = Number(match[1] ?? 1), sides = Number(match[2]);
    return count >= 1 && count <= 20 && sides >= 2 && sides <= 1000 ? { count, sides } : null;
}

module.exports = {
    name: "roll",
    description: 'Roll dice, like 2d6 or d20 (default: one 6-sided die).',
    aliases: ['dice'],
    options: [{ name: 'dice', description: 'For example 2d6, d20 or 100', type: ApplicationCommandOptionType.String, max_length: 10 }],
    parseDice,
    run: async (client, message, args) => {
        const dice = parseDice(args[0]);
        if (!dice) return message.reply("Try something like `roll 2d6` or `roll d20` (up to 20 dice, 2 to 1000 sides).");
        const rolls = Array.from({ length: dice.count }, () => 1 + Math.floor(Math.random() * dice.sides));
        const total = rolls.reduce((a, b) => a + b, 0);
        return message.reply(`🎲 ${dice.count}d${dice.sides}: ${dice.count > 1 ? `${rolls.join(" + ")} = ` : ""}**${total}**`);
    }
};
