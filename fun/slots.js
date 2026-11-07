// LOONA slot machine: the 12 members' animals plus the moon jackpot.
const { randomInt } = require("node:crypto");

const JACKPOT = "🌙";
// Debut order: Heejin, Hyunjin, Haseul, Yeojin, ViVi, Kim Lip, JinSoul, Choerry, Yves, Chuu, Go Won, Olivia Hye.
const ANIMALS = ["🐰", "🐱", "🐦", "🐸", "🦌", "🦉", "🐟", "🦇", "🦢", "🐧", "🦋", "🐺"];
const SYMBOLS = [...ANIMALS, JACKPOT];

// Total returned for a bet (0 = lost it). Over many spins this pays back about 93% of what's bet.
const PAIR = 3, TRIPLE = 40, MOONS = 150;

function payout([a, b, c], bet) {
    if (a === b && b === c) return bet * (a === JACKPOT ? MOONS : TRIPLE);
    if (a === b || b === c || a === c) return bet * PAIR;
    return 0;
}

const spin = () => [0, 1, 2].map(() => SYMBOLS[randomInt(SYMBOLS.length)]);

module.exports = { SYMBOLS, JACKPOT, payout, spin, PAIR, TRIPLE, MOONS };
