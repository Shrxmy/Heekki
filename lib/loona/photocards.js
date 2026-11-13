// LOONA photocards: 12 members x 4 rarities, each drawn as a card around one of her licensed photos.
const path = require("node:path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const loona = require(".");
const http = require("../info/http");

const FONT = "Noto Sans KR";
GlobalFonts.registerFromPath(path.join(__dirname, "..", "..", "assets", "fonts", "NotoSansKR.ttf"), FONT);

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

/** The card for a member and rarity: { id, member, rarity, photo }. Each rarity uses a different photo where she has enough. */
function card(member, rarity) {
    const r = RARITIES.findIndex((x) => x.key === rarity.key);
    return { id: `${member.key}-${rarity.key}`, member, rarity, photo: member.photos[r % member.photos.length] };
}
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

// --- Drawing ---------------------------------------------------------------

const W = 560, H = 860, PAD = 26, PHOTO_H = 680, RADIUS = 28;
const FRAMES = {
    common: (ctx, m) => m.color.hex,
    rare: (ctx) => gradient(ctx, ["#e8e8f0", "#9aa0b0", "#f6f6fa", "#8a90a0"]),
    super: (ctx) => gradient(ctx, ["#fff1a8", "#d4a017", "#fff6c4", "#b8860b"]),
    moon: (ctx) => gradient(ctx, loona.members.map((x) => x.color.hex)),
};
function gradient(ctx, colors) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    return g;
}

const photoCache = new Map(); // url -> Promise<Image|null>; at most one entry per card
function loadPhoto(url) {
    if (!photoCache.has(url)) {
        photoCache.set(url, http.getBuffer(url, { timeoutMs: 8000 }).then(loadImage).catch(() => {
            photoCache.delete(url); // try again next time instead of remembering the failure
            return null;
        }));
    }
    return photoCache.get(url);
}

function drawStar(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const radius = i % 2 ? r * 0.45 : r;
        ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fill();
}

/** Draws the cover-cropped photo, or her colour with her initial if the photo couldn't load. */
function drawPhoto(ctx, image, member) {
    const x = PAD, y = PAD, w = W - PAD * 2, h = PHOTO_H;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, RADIUS - 8);
    ctx.clip();
    if (image) {
        const scale = Math.max(w / image.width, h / image.height);
        const sw = w / scale, sh = h / scale;
        ctx.drawImage(image, (image.width - sw) / 2, 0, sw, sh, x, y, w, h); // crop from the top, where faces are
    } else {
        ctx.fillStyle = member.color.hex;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.font = `bold 220px "${FONT}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(Array.from(member.name)[0], x + w / 2, y + h / 2);
    }
    ctx.restore();
}

/** @returns {Promise<Buffer>} a 560x860 PNG of the card */
async function renderPhotocard(c) {
    const { member, rarity } = c;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = FRAMES[rarity.key](ctx, member);
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, RADIUS);
    ctx.fill();
    ctx.fillStyle = "#14101f";
    ctx.beginPath();
    ctx.roundRect(12, 12, W - 24, H - 24, RADIUS - 6);
    ctx.fill();

    drawPhoto(ctx, await loadPhoto(c.photo.url), member);

    const textY = PAD + PHOTO_H;
    ctx.fillStyle = member.color.hex;
    ctx.fillRect(PAD, textY + 18, 6, 92);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "alphabetic";
    ctx.font = `bold 52px "${FONT}"`;
    ctx.fillText(member.name, PAD + 24, textY + 70);
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = `26px "${FONT}"`;
    ctx.fillText(`${member.korean} · LOONA #${member.order}`, PAD + 24, textY + 108);

    ctx.fillStyle = rarity.key === "common" ? member.color.hex : FRAMES[rarity.key](ctx, member);
    for (let i = 0; i < rarity.stars; i++) drawStar(ctx, W - PAD - 22 - i * 40, textY + 56, 16);
    ctx.font = `bold 20px "${FONT}"`;
    ctx.textAlign = "right";
    ctx.letterSpacing = "3px";
    ctx.fillText(rarity.label.toUpperCase(), W - PAD - 6, textY + 108);
    return canvas.encode("png");
}

module.exports = { PRICE, RARITIES, SETS, ALL, card, findCard, roll, completedSets, renderPhotocard };
