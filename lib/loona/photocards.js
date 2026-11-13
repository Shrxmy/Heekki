// Photocards: every member of each group in 4 rarities. LOONA's are real photocard scans
// (lib/loona/photocard-scans.json); other groups live in lib/cards/<group>.json. Every image is in the Neon bucket.
const fs = require("node:fs");
const path = require("node:path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const loona = require(".");
const storage = require("../storage");
const design = require("../design");
const { cards: SCANS } = require("./photocard-scans.json");

const PRICE = 150;
// What `sell` pays per duplicate. A pull's card is worth 81 on average, under the 150 a pull costs, so pulling
// to sell never makes coins.
const SELL_PRICES = { common: 30, rare: 75, super: 200, moon: 750 };
// Weights add up to 100, so each is also the chance in percent.
const RARITIES = [
    { key: "common", label: "Common", weight: 60, stars: 1 },
    { key: "rare", label: "Rare", weight: 27, stars: 2 },
    { key: "super", label: "Super", weight: 10, stars: 3 },
    { key: "moon", label: "Moon", weight: 3, stars: 4 },
];

// Groups, LOONA first. Member keys are unique across groups ("heejin", "twice.nayeon"), and card ids are
// "<member key>-<rarity>", so LOONA's ids are unchanged from when it was the only group.
const GROUPS = new Map([["loona", { key: "loona", name: "LOONA", short: "LOONA", korean: "이달의 소녀", color: "#7632A0", wordmark: true,
    members: loona.members, images: SCANS, credit: (scan) => `Scan: Savvi's LOONA Scans (@pika_chuuves) · ${scan.from}` }]]);
for (const file of fs.readdirSync(path.join(__dirname, "..", "cards")).filter((f) => f.endsWith(".json")).sort()) {
    const g = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "cards", file), "utf8"));
    GROUPS.set(g.key, { ...g, members: g.members.map((m) => ({ ...m, color: { hex: m.color } })), images: g.cards, credit: (scan) => scan.credit });
}
for (const g of GROUPS.values()) for (const m of g.members) m.group = g.key;
const groupOf = (member) => GROUPS.get(member.group);

// LOONA 1/3 is the original four; YeoJin only joined them for the Love & Evil repackage. Every group also has a
// full-group set worth 150 coins per member (LOONA's stays 2000).
const SETS = [
    { key: "1/3", label: "LOONA 1/3", group: "loona", members: ["heejin", "hyunjin", "haseul", "vivi"], bonus: 500 },
    { key: "oec", label: "ODD EYE CIRCLE", group: "loona", members: ["kimlip", "jinsoul", "choerry"], bonus: 500 },
    { key: "yyxy", label: "yyxy", group: "loona", members: ["yves", "chuu", "gowon", "hyeju"], bonus: 500 },
    { key: "loona", label: "LOONA (all 12)", group: "loona", members: loona.members.map((m) => m.key), bonus: 2000 },
    ...[...GROUPS.values()].filter((g) => g.key !== "loona").map((g) => ({ key: g.key, label: `${g.short} (all ${g.members.length})`, group: g.key,
        members: g.members.map((m) => m.key), bonus: 150 * g.members.length })),
];

/** Where a card's image lives in the Neon bucket (uploaded by scripts/upload-photocard-scans.js). */
const scanKey = (id) => `photocards/${id}.jpg`;
/** The card for a member and rarity: { id, member, rarity, group, scan: { from, … } }. */
function card(member, rarity) {
    const id = `${member.key}-${rarity.key}`, group = groupOf(member);
    return { id, member, rarity, group, scan: group.images[id] };
}
/** The credit line shown with every card: the scanner for LOONA, the photographer and licence for the others. */
const credit = (c) => c.group.credit(c.scan);
const ALL = [...GROUPS.values()].flatMap((g) => g.members.flatMap((m) => RARITIES.map((r) => card(m, r))));
const byId = new Map(ALL.map((c) => [c.id, c]));
const findCard = (id) => byId.get(id) ?? null;
/** "HeeJin" for LOONA (the bot's home group), "TWICE Nayeon" for the others. */
const fullName = (member) => (member.group === "loona" ? member.name : `${groupOf(member).short} ${member.name}`);

/** A random card from `groups` (keys; default LOONA): each group is equally likely, then the rarity, then the member. */
function roll(random = Math.random, groups = ["loona"]) {
    const pool = groups.map((k) => GROUPS.get(k)).filter(Boolean);
    const group = pool.length ? pool[Math.floor(random() * pool.length)] : GROUPS.get("loona");
    let n = random() * 100;
    const rarity = RARITIES.find((r) => (n -= r.weight) < 0) ?? RARITIES[0];
    return card(group.members[Math.floor(random() * group.members.length)], rarity);
}

// Every way a member can be named ("Nayeon", "Im Nayeon", "나연", "twice nayeon"), squashed like loona.findMember does.
const squash = (t) => String(t).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const memberIndex = new Map();
for (const g of GROUPS.values()) for (const m of g.members) {
    for (const name of [m.name, m.korean, m.key.split(".").pop(), ...(m.aliases ?? [])].filter(Boolean)) {
        for (const key of [squash(name), squash(`${g.key} ${name}`), squash(`${g.short} ${name}`)]) if (!memberIndex.has(key)) memberIndex.set(key, m);
    }
}
/** The member called `query` in any group ("nayeon", "twice nayeon", "kim lip"), or null. */
const findAnyMember = (query) => memberIndex.get(squash(query)) ?? null;

/** The card named by some words ("kim lip rare", "twice nayeon moon", "chuu-moon"), or null. Shared by sell and showcase. */
function parseCard(args) {
    const words = args.map((a) => String(a).toLowerCase());
    const rarity = RARITIES.find((r) => r.key === words.at(-1));
    if (rarity) {
        const member = findAnyMember(words.slice(0, -1).join(" "));
        return member ? card(member, rarity) : null;
    }
    return findCard(words.join(""));
}

/** Saved group keys that still exist (a group could be removed later), or LOONA if none do. */
const validGroups = (keys) => { const ok = [...new Set(keys)].filter((k) => GROUPS.has(k)); return ok.length ? ok : ["loona"]; };

/** The group a word names ("twice", "TXT", "tomorrow x together", "loona"), or null. */
const findGroup = (word) => [...GROUPS.values()].find((g) => [g.key, g.name, g.short, g.korean].some((n) => squash(n) === squash(word))) ?? null;

/** Sets complete in `owned` (card ids), counting any rarity of each member. */
function completedSets(owned) {
    const members = new Set([...owned].map((id) => findCard(id)?.member.key).filter(Boolean));
    return SETS.filter((s) => s.members.every((key) => members.has(key)));
}

// --- Drawing: a solo-album page (cream paper, 이달의 소녀 + her name in script) holding the photocard --------

const W = 600, H = 900;
const CARD = { w: 372, h: 572, y: 196, r: 16 };
const LABEL_STYLE = { common: "plain", rare: "highlight", super: "box", moon: "moon" };

const scanCache = new Map(); // card id -> Promise<Image|null>; 48 scans of ~100 KB at most
function loadScan(id) {
    if (!scanCache.has(id)) {
        scanCache.set(id, storage.get(scanKey(id)).then(loadImage).catch(() => {
            scanCache.delete(id); // try again next time instead of remembering the failure
            return null;
        }));
    }
    return scanCache.get(id);
}

/** 이달의 소녀 + her name handwritten in her colour, over a hairline rule, like the solo album covers. */
function drawTitle(ctx, member) {
    ctx.textBaseline = "alphabetic";
    const group = groupOf(member);
    // LOONA: the official 이달의 소녀 wordmark. Other groups: their name in bold geometric capitals.
    ctx.font = design.font("sans", 30, 700);
    ctx.letterSpacing = "1px";
    const korH = 30, korW = group.wordmark ? design.wordmarkWidth("full", korH) : ctx.measureText(group.short).width;
    ctx.letterSpacing = "0px";
    // Word by word: handwriting fonts (Ting Tong especially) have very wide spaces, which split "Kim Lip" apart.
    ctx.font = design.font("script", 58);
    const words = member.name.split(" "), wordGap = 14;
    const nameW = words.reduce((w, word) => w + ctx.measureText(word).width, 0) + wordGap * (words.length - 1);
    const gap = 14, total = korW + gap + nameW, x = (W - total) / 2;
    if (group.wordmark) design.wordmark(ctx, "full", x, 112 - korH, korH); // sits on the same line as the name
    else {
        ctx.fillStyle = design.INK;
        ctx.font = design.font("sans", 30, 700);
        ctx.letterSpacing = "1px";
        ctx.fillText(group.short, x, 112);
        ctx.letterSpacing = "0px";
    }
    ctx.fillStyle = design.onPaper(member.color.hex); // HyunJin's yellow is darkened a touch so it reads
    ctx.font = design.font("script", 58);
    let wx = x + korW + gap;
    for (const word of words) { ctx.fillText(word, wx, 114); wx += ctx.measureText(word).width + wordGap; }
    const half = Math.max(170, total / 2 + 12); // the rule always reaches past the title
    design.rule(ctx, W / 2 - half, W / 2 + half, 140, "rgba(27, 26, 26, 0.55)");
}

function drawScan(ctx, image, member) {
    const x = (W - CARD.w) / 2, { y, w, h, r } = CARD;
    ctx.save(); // soft shadow, as if the card were lying on the page
    ctx.shadowColor = "rgba(40, 30, 20, 0.28)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = design.PAPER;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.clip();
    if (image) {
        design.cover(ctx, image, x, y, w, h);
    } else { // the scan couldn't load: her colour and initial, so the card still shows
        ctx.fillStyle = member.color.hex;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.font = design.font("script", 200);
        ctx.textAlign = "center";
        ctx.fillText(Array.from(member.name)[0], W / 2, y + h / 2 + 60);
    }
    ctx.restore();
}

/** @returns {Promise<Buffer>} a 600x900 PNG of the card */
async function renderPhotocard(c) {
    await design.ready;
    const { member, rarity } = c;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    design.paper(ctx, W, H);

    ctx.fillStyle = design.MUTED;
    ctx.font = design.font("didot", 17, 500);
    ctx.textAlign = "center";
    ctx.fillText(`Nº${member.order}`, W / 2, 52);
    ctx.textAlign = "left";
    drawTitle(ctx, member);
    ctx.fillStyle = design.MUTED;
    ctx.font = design.font("serif", 15);
    ctx.textAlign = "center";
    ctx.font = design.font("light", 13, 300);
    ctx.letterSpacing = "2px"; // thin spaced capitals, like ODD EYE CIRCLE's lettering
    ctx.fillText(`FROM ${c.scan.from.toUpperCase()}`, W / 2, 168);
    ctx.letterSpacing = "0px";
    ctx.textAlign = "left";

    drawScan(ctx, await loadScan(c.id), member);

    // "heejin the MOON", in the discography sheet's style: plain, her colour, black box, black box + twelve colours
    ctx.font = design.font("serif", 26, 700);
    const lead = `${member.name.toLowerCase()} the `, word = rarity.label.toUpperCase();
    const leadW = ctx.measureText(lead).width, wordW = ctx.measureText(word).width;
    const gap = 8, lx = (W - leadW - gap - wordW) / 2, ly = 828;
    ctx.fillStyle = design.INK;
    ctx.fillText(lead, lx, ly);
    design.label(ctx, word, lx + leadW + gap, ly, { style: LABEL_STYLE[rarity.key], color: member.color.hex, size: 26, colors: groupOf(member).members.map((m) => m.color.hex) });
    return canvas.encode("png");
}

module.exports = { GROUPS, validGroups, parseCard, findAnyMember, findGroup, fullName, PRICE, SELL_PRICES, RARITIES, SETS, ALL, card, findCard, roll, completedSets, renderPhotocard, scanKey, credit };
