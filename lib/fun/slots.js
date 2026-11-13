// LOONA slot machine: the 12 members' animals plus the moon jackpot.
const { randomInt } = require("node:crypto");

const JACKPOT = "🌙";
// Debut order: Heejin, Hyunjin, Haseul, Yeojin, ViVi, Kim Lip, JinSoul, Choerry, Yves, Chuu, Go Won, Olivia Hye.
const ANIMALS = ["🐰", "🐱", "🐦", "🐸", "🦌", "🦉", "🐟", "🦇", "🦢", "🐧", "🦋", "🐺"];
const SYMBOLS = [...ANIMALS, JACKPOT];

// Total returned for a bet (0 = lost it). Over many spins this pays back 97.5% of what's bet, and 40% of spins
// return something: a lone moon gives the bet back, so small wins come often and the jackpots stay special.
const PAIR = 2, MOON_PAIR = 7, TRIPLE = 40, MOONS = 150, MOON_SAVE = 1;

function payout([a, b, c], bet) {
    if (a === b && b === c) return bet * (a === JACKPOT ? MOONS : TRIPLE);
    const pair = a === b || a === c ? a : b === c ? b : null;
    if (pair) return bet * (pair === JACKPOT ? MOON_PAIR : PAIR);
    return [a, b, c].includes(JACKPOT) ? bet * MOON_SAVE : 0;
}

const spin = () => [0, 1, 2].map(() => SYMBOLS[randomInt(SYMBOLS.length)]);

module.exports = { SYMBOLS, JACKPOT, payout, spin, PAIR, MOON_PAIR, TRIPLE, MOONS, MOON_SAVE };
