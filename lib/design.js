// Heekki's drawn look, after LOONA's album design: cream paper, "이달의 소녀" with her name in thin script,
// hairline rules, small serif text, and the discography sheet's highlighter boxes. Free (OFL) stand-ins for the
// album fonts are bundled in assets/fonts, so cards look the same on any host.
const fs = require("node:fs");
const path = require("node:path");
const { GlobalFonts, loadImage } = require("@napi-rs/canvas");

const dir = path.join(__dirname, "..", "assets", "fonts");
const FONTS = {
    korean: ["Noto Sans KR", "NotoSansKR.ttf"], // 210 맨발의청춘 stand-in, and every Korean letter
    sans: ["Jost", "Jost.ttf"], // AGFatumC stand-in ("Who's Next Girl?")
    light: ["Jost", "Jost.ttf"], // Avant Garde Gothic Extra Light stand-in (ODD EYE CIRCLE's thin capitals)
    didot: ["Bodoni Moda", "BodoniModa.ttf"], // Didot stand-in (1/3)
    serif: ["Libre Caslon Text", "LibreCaslonText.ttf"], // Adobe Caslon stand-in (yyxy, the discography sheet)
    serifItalic: ["Libre Caslon Text Italic", "LibreCaslonText-Italic.ttf"],
    script: ["Sacramento", "Sacramento.ttf"], // Ting Tong stand-in: the handwritten names on the solo albums
};
for (const [family, file] of Object.values(FONTS)) GlobalFonts.registerFromPath(path.join(dir, file), family);

// Licensed copies of the real album fonts can't be committed, so they go in assets/fonts/local/ (git-ignored),
// named after the role they take over: korean.otf (210 맨발의청춘), light.otf (Avant Garde Extra Light), and so on.
const localDir = process.env.HEEKKI_LOCAL_FONTS || path.join(dir, "local");
for (const role of Object.keys(FONTS)) {
    const file = [".otf", ".ttf"].map((ext) => path.join(localDir, role + ext)).find((f) => fs.existsSync(f));
    if (file && GlobalFonts.registerFromPath(file, `Heekki ${role}`)) FONTS[role] = [`Heekki ${role}`, file];
}

/** A canvas font string; Korean letters come from the Korean font, and Noto Sans KR covers anything it lacks. */
const font = (kind, size, weight = 400) => `${weight} ${size}px "${FONTS[kind][0]}", "${FONTS.korean[0]}", "Noto Sans KR"`;

const PAPER = "#ECE7DF", INK = "#1B1A1A", MUTED = "#6F6A63";

// LOONA's own 이달의 소녀 wordmark (Wikimedia Commons, public domain as a text logo), cropped from
// "LOONA ODD EYE CIRCLE Logo.png": whole, and split before 소 so it can stack in two lines like the teasers.
const WORDMARKS = {};
// Images decode in the background, so renderers await this before drawing (otherwise the first card has no logo).
const ready = Promise.all(Object.entries({ full: "loona-wordmark.png", top: "loona-wordmark-1.png", bottom: "loona-wordmark-2.png" })
    .map(async ([part, file]) => { WORDMARKS[part] = await loadImage(path.join(__dirname, "..", "assets", "images", file)); }));
/** Width of the wordmark ("full", or "top" = 이달의 / "bottom" = 소녀) drawn `height` px tall. */
const wordmarkWidth = (part, height) => (WORDMARKS[part].width / WORDMARKS[part].height) * height;
/** Draws the wordmark with its top-left corner at (x, y), `height` px tall. */
const wordmark = (ctx, part, x, y, height) => ctx.drawImage(WORDMARKS[part], x, y, wordmarkWidth(part, height), height);

/** Relative luminance (0 = black, 1 = white) of a "#RRGGBB" colour. */
function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Text colour on a `hex` fill: black on light colours, white on dark ones. */
const inkOn = (hex) => (luminance(hex) > 0.25 ? INK : "#FFFFFF");
/** `hex` darkened just enough to read on the cream paper (light pinks and yellows); dark colours are unchanged. */
function onPaper(hex) {
    let [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const toHex = () => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
    for (let i = 0; i < 12 && luminance(toHex()) > 0.23; i++) [r, g, b] = [r * 0.88, g * 0.88, b * 0.88];
    return toHex();
}

/** Cream album paper with a little film grain and a soft vignette. */
function paper(ctx, w, h) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, Math.max(w, h) * 0.75);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.35)");
    glow.addColorStop(1, "rgba(90, 80, 70, 0.12)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 0.05);
}

/** Fixed-pattern grain (same on every card), like the matte album stock. */
function grain(ctx, w, h, alpha) {
    let seed = 12;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    ctx.save();
    for (let i = 0; i < (w * h) / 60; i++) {
        ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
        ctx.fillRect(rand() * w, rand() * h, 1.2, 1.2);
    }
    ctx.restore();
}

function rule(ctx, x1, x2, y, color = INK, width = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
}

/** Shortens text with "…" until it fits maxWidth in the current font. */
function fit(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    const chars = Array.from(text);
    while (chars.length && ctx.measureText(chars.join("") + "…").width > maxWidth) chars.pop();
    return chars.join("") + "…";
}

/**
 * Discography-sheet label at (x, baseline y): "plain" text, "highlight" (her colour behind black text),
 * "box" (black box, white text) or "moon" (black box with all twelve colours underneath). Returns its width.
 */
function label(ctx, text, x, y, { style, color, size, colors }) {
    ctx.save();
    ctx.font = font("serif", size, 700);
    const w = ctx.measureText(text).width, padX = size * 0.25, top = y - size * 0.82, h = size * 1.08;
    if (style === "highlight") { ctx.fillStyle = color; ctx.fillRect(x - padX, top, w + padX * 2, h); }
    if (style === "box" || style === "moon") { ctx.fillStyle = INK; ctx.fillRect(x - padX, top, w + padX * 2, h); }
    if (style === "moon") colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(x - padX + ((w + padX * 2) * i) / colors.length, top + h, (w + padX * 2) / colors.length + 0.5, size * 0.18);
    });
    ctx.fillStyle = style === "box" || style === "moon" ? "#FFFFFF" : style === "highlight" ? inkOn(color) : INK;
    ctx.fillText(text, x, y);
    ctx.restore();
    return w;
}

/** Draws `image` cover-cropped into the box, cropping from the top (where faces are), centred on `centerX` (0-1 across the image). */
function cover(ctx, image, x, y, w, h, { anchorY = 0, centerX = 0.5 } = {}) {
    const scale = Math.max(w / image.width, h / image.height);
    const sw = w / scale, sh = h / scale;
    const sx = Math.min(Math.max(image.width * centerX - sw / 2, 0), image.width - sw); // never past the image's edges
    ctx.drawImage(image, sx, (image.height - sh) * anchorY, sw, sh, x, y, w, h);
}

module.exports = { font, paper, grain, rule, fit, label, cover, luminance, inkOn, onPaper, wordmark, wordmarkWidth, ready, PAPER, INK, MUTED };
