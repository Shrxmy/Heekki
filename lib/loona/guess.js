// The LOONA song guessing game's rules: the song pool, picking songs, and checking guesses.
const { songs } = require("./songs.json");

const ROUNDS = 10, CLIP_MS = 20_000, ROUND_MS = 25_000, COINS_PER_ROUND = 30, BREAK_MS = 3000;

// "Oh (Yes I Am)!" and "oh yes i am" compare equal; Korean letters are kept.
const normalize = (text) => String(text).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function distance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const keep = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = keep;
        }
    }
    return row[b.length];
}

/** True if `guess` names the song: any of its titles, ignoring case, spaces and punctuation, with a typo allowed in longer titles. */
function isCorrect(guess, song) {
    const g = normalize(guess);
    if (!g) return false;
    return [song.title, ...song.aliases].some((name) => {
        const n = normalize(name);
        const typos = n.length >= 10 ? 2 : n.length >= 6 ? 1 : 0;
        const digits = (t) => t.replace(/\D/g, ""); // "The Carol" isn't "The Carol 2.0": numbers must match exactly
        return g === n || (typos > 0 && digits(g) === digits(n) && Math.abs(g.length - n.length) <= typos && distance(g, n) <= typos);
    });
}

// Other names an artist's YouTube channel goes by.
const ARTIST_NAMES = { "Olivia Hye": ["HyeJu", "혜주"], YeoJin: ["여진"], HyunJin: ["현진"], HaSeul: ["하슬"], HeeJin: ["희진"],
    Chuu: ["츄"], Yves: ["이브"], "Kim Lip": ["김립"], JinSoul: ["진솔"], Choerry: ["최리"], "Go Won": ["고원"] };
const GROUP = /loona|이달의소녀/; // the group's own channels, which also carry the pre-debut solos and units

/** True if a search result is this song by this artist: its title names the song, and its channel is the artist. */
function resultMatches(info, song) {
    const t = normalize(info.title);
    const titleOk = [song.title, ...song.aliases].some((name) => t.includes(normalize(name))) || isCorrect(info.title, song);
    // "HaSeul (ARTMS)" and "YEOJIN(L∞na)" are her; "YVES H" and "tripleS" are not, even with the right song title.
    const channel = normalize(String(info.author).replace(/\s*\(.*?\)\s*/g, ""));
    const channelOk = GROUP.test(normalize(info.author))
        || [song.artist, ...(ARTIST_NAMES[song.artist] ?? [])].some((name) => channel === normalize(name));
    return titleOk && channelOk;
}

/** `count` different songs in random order. `random` is injectable for tests. */
function pickSongs(count = ROUNDS, random = Math.random) {
    const pool = [...songs];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}

/** Where the clip starts: 15–55% into the song, so it's past the intro, but always leaving room for the whole clip. */
const clipStart = (lengthMs, random = Math.random) =>
    Math.max(0, Math.min(Math.floor(lengthMs * (0.15 + random() * 0.4)), lengthMs - CLIP_MS));

/** The players with the top score (ties share it), or [] if nobody scored. */
function winners(scores) {
    const best = Math.max(0, ...scores.values());
    return best ? [...scores].filter(([, s]) => s === best).map(([id]) => id) : [];
}

module.exports = { songs, ROUNDS, CLIP_MS, ROUND_MS, COINS_PER_ROUND, BREAK_MS, normalize, isCorrect, resultMatches, pickSongs, clipStart, winners };
