// LOONA photocards: 12 members x 4 rarities, each one a real photocard scan (lib/loona/photocard-scans.json).
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const loona = require(".");
const storage = require("../storage");
const design = require("../design");
const { cards: SCANS } = require("./photocard-scans.json");


const PRICE = 150;
// Weights add up to 100, so each is also the chance in percent.
const RARITIES = [
    { key: "common", label: "Common", weight: 60, stars: 1 },
    { key: "rare", label: "Rare", weight: 27, stars: 2 },
    { key: "super", label: "Super", weight: 10, stars: 3 },
    { key: "moon", label: "Moon", weight: 3, stars: 4 },
];
// LOONA 1/3 is the original four; YeoJin only joined them for the Love & Evil repackage.
const SETS = [
    { key: "1/3", label: "LOONA 1/3", members: ["heejin", "hyunjin", "haseul", "vivi"], bonus: 500 },
    { key: "oec", label: "ODD EYE CIRCLE", members: ["kimlip", "jinsoul", "choerry"], bonus: 500 },
    { key: "yyxy", label: "yyxy", members: ["yves", "chuu", "gowon", "hyeju"], bonus: 500 },
    { key: "loona", label: "LOONA (all 12)", members: loona.members.map((m) => m.key), bonus: 2000 },
];

/** Where a card's scan lives in the Neon bucket (uploaded by scripts/upload-photocard-scans.js). */
const scanKey = (id) => `photocards/${id}.jpg`;
/** The card for a member and rarity: { id, member, rarity, scan: { from, file } }. */
function card(member, rarity) {
    const id = `${member.key}-${rarity.key}`;
    return { id, member, rarity, scan: SCANS[id] };
}
/** The line crediting the scanner, shown with every card. */
const credit = (c) => `Scan: Savvi's LOONA Scans (@pika_chuuves) · ${c.scan.from}`;
const ALL = loona.members.flatMap((m) => RARITIES.map((r) => card(m, r)));
const byId = new Map(ALL.map((c) => [c.id, c]));
const findCard = (id) => byId.get(id) ?? null;

/** A random card. `random` is injectable for tests. */
function roll(random = Math.random) {
    let n = random() * 100;
    const rarity = RARITIES.find((r) => (n -= r.weight) < 0) ?? RARITIES[0];
    const member = loona.members[Math.floor(random() * loona.members.length)];
    return card(member, rarity);
}

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
    ctx.font = design.font("korean", 34, 500);
    const kor = "이달의 소녀", korW = ctx.measureText(kor).width;
    ctx.font = design.font("script", 58);
    const nameW = ctx.measureText(member.name).width;
    const gap = 14, x = (W - korW - gap - nameW) / 2;
    ctx.fillStyle = design.INK;
    ctx.font = design.font("korean", 34, 500);
    ctx.fillText(kor, x, 112);
    ctx.fillStyle = design.onPaper(member.color.hex); // HyunJin's yellow is darkened a touch so it reads
    ctx.font = design.font("script", 58);
    ctx.fillText(member.name, x + korW + gap, 114);
    design.rule(ctx, W / 2 - 170, W / 2 + 170, 140, "rgba(27, 26, 26, 0.55)");
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
    design.label(ctx, word, lx + leadW + gap, ly, { style: LABEL_STYLE[rarity.key], color: member.color.hex, size: 26, colors: loona.members.map((m) => m.color.hex) });
    return canvas.encode("png");
}

module.exports = { PRICE, RARITIES, SETS, ALL, card, findCard, roll, completedSets, renderPhotocard, scanKey, credit };
