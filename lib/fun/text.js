// Text toys for the Fun commands. Every output is capped to fit in one Discord message.
const MAX = 1900;

/** Joins pieces until adding another would pass the cap (never cuts an emoji in half). */
function capped(pieces, separator = "") {
    let out = "";
    for (const piece of pieces) {
        const next = out ? out + separator + piece : piece;
        if (next.length > MAX) break;
        out = next;
    }
    return out;
}

const REGIONAL_A = 0x1f1e6;
function emojify(text) {
    return capped(Array.from(text.toLowerCase(), (ch) => {
        if (ch >= "a" && ch <= "z") return String.fromCodePoint(REGIONAL_A + ch.charCodeAt(0) - 97);
        if (ch >= "0" && ch <= "9") return `${ch}️⃣`;
        return ch;
    }), " "); // spaces stop neighbouring letters from merging into flags
}

const FLIP = Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz0123456789.,!?'\"()[]{}<>&_"].map((c, i) =>
    [c, [..."ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz0ƖᄅƐㄣϛ9ㄥ86˙'¡¿,„)(][}{><⅋‾"][i]]));
const flipText = (text) => capped(Array.from(text).reverse().map((ch) => FLIP[ch.toLowerCase()] ?? ch));

// Minecraft's enchanting-table letters (the Standard Galactic Alphabet).
const SGA = {
    a: "ᔑ", b: "ʖ", c: "ᓵ", d: "↸", e: "ᒷ", f: "⎓", g: "⊣", h: "⍑", i: "╎", j: "⋮", k: "ꖌ", l: "ꖎ", m: "ᒲ",
    n: "リ", o: "𝙹", p: "!¡", q: "ᑑ", r: "∷", s: "ᓭ", t: "ℸ ̣", u: "⚍", v: "⍊", w: "∴", x: " ̇/", y: "||", z: "⨅",
};
const enchant = (text) => capped(Array.from(text.toLowerCase(), (ch) => SGA[ch] ?? ch));

function zalgo(text) {
    return capped(Array.from(text, (ch) => {
        if (/\s/.test(ch)) return ch;
        let marks = "";
        const count = 1 + Math.floor(Math.random() * 6);
        for (let i = 0; i < count; i++) marks += String.fromCharCode(0x300 + Math.floor(Math.random() * 0x70)); // combining marks
        return ch + marks;
    }));
}

const PRINTABLE = /^[^\p{Cc}�]*$/u; // no control characters or broken bytes (newlines/tabs allowed below)
const readable = (s) => (s && PRINTABLE.test(s.replace(/[\n\t]/g, "")) ? s.slice(0, MAX) : null);

/** Decodes binary (8-bit groups) or base64 text; null when it's neither. */
function decode(input) {
    const text = input.trim();
    const bits = text.replace(/\s+/g, "");
    if (/^[01]+$/.test(bits) && bits.length % 8 === 0)
        return readable(Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2))).toString("utf8"));
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(text) && text.length % 4 === 0)
        return readable(Buffer.from(text, "base64").toString("utf8"));
    return null;
}

module.exports = { emojify, flipText, enchant, zalgo, decode };
