// LOONA slot machine: the 12 members' animals plus the moon jackpot.
const { randomInt } = require("node:crypto");

const JACKPOT = "🌙";
// Debut order: Heejin, Hyunjin, Haseul, Yeojin, ViVi, Kim Lip, JinSoul, Choerry, Yves, Chuu, Go Won, Olivia Hye.
const ANIMALS = ["🐰", "🐱", "🐦", "🐸", "🦌", "🦉", "🐟", "🦇", "🦢", "🐧", "🦋", "🐺"];
const SYMBOLS = [...ANIMALS, JACKPOT];

// Total returned for a bet (0 = lost it): a lone moon gives the bet back, a pair x2, a pair of moons x7,
// three of an animal x20, three moons x150. Several spins in one go build streaks: the 2nd combo in a row has its
// winnings doubled, the 3rd and later tripled. Paid back over time: 86.6% for 1 spin, 96.1% for 5, 97.6% for 10
// (test/fun-more.test.js checks these exactly), so streaks reward playing on without ever printing coins.
const PAIR = 2, MOON_PAIR = 7, TRIPLE = 20, MOONS = 150, MOON_SAVE = 1, STREAK_CAP = 3, MAX_SPINS = 10;

function payout([a, b, c], bet) {
    if (a === b && b === c) return bet * (a === JACKPOT ? MOONS : TRIPLE);
    const pair = a === b || a === c ? a : b === c ? b : null;
    if (pair) return bet * (pair === JACKPOT ? MOON_PAIR : PAIR);
    return [a, b, c].includes(JACKPOT) ? bet * MOON_SAVE : 0;
}

const spin = () => [0, 1, 2].map(() => SYMBOLS[randomInt(SYMBOLS.length)]);

/** A combo is any pair or three of a kind; a lone moon only gives the bet back, so it isn't one. */
const isCombo = ([a, b, c]) => a === b || b === c || a === c;

/**
 * `count` spins of `bet`, each { reels, won, streak }. A combo right after a combo continues the streak, and its
 * winnings (what it pays above the bet) are multiplied by the streak, up to STREAK_CAP.
 */
function playSpins(count, bet) {
    let streak = 0;
    return Array.from({ length: count }, () => {
        const reels = module.exports.spin(); // through exports, so tests can choose the reels
        const base = payout(reels, bet);
        streak = isCombo(reels) ? streak + 1 : 0;
        const won = streak ? bet + (base - bet) * Math.min(streak, STREAK_CAP) : base;
        return { reels, won, streak };
    });
}

module.exports = { SYMBOLS, JACKPOT, payout, spin, isCombo, playSpins, PAIR, MOON_PAIR, TRIPLE, MOONS, MOON_SAVE, STREAK_CAP, MAX_SPINS };
