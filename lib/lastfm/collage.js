// Draws a 3x3 grid of album covers with the album and artist names on each tile.
const path = require("node:path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const http = require("../info/http");
const { memberFor } = require("../loona");

const FONT = "Noto Sans KR"; // same bundled font as the welcome cards, so Korean titles render
GlobalFonts.registerFromPath(path.join(__dirname, "..", "..", "assets", "fonts", "NotoSansKR.ttf"), FONT);

// Up to 10x10. Tiles shrink as the grid grows so the picture stays around 1500px wide.
const MAX_SIDE = 10, MAX_TILE = 300, MAX_WIDTH = 1500, AT_ONCE = 10;
/** "5x5" or "4x6" anywhere in args -> { cols, rows } (default 3x3); null if a size is given but out of range. */
function sizeFrom(args) {
    const m = args.map((a) => /^(\d{1,2})x(\d{1,2})$/i.exec(a)).find(Boolean);
    if (!m) return { cols: 3, rows: 3 };
    const cols = Number(m[1]), rows = Number(m[2]);
    return cols >= 1 && rows >= 1 && cols <= MAX_SIDE && rows <= MAX_SIDE ? { cols, rows } : null;
}

/** Shortens text with "…" until it fits maxWidth in the current font. */
function fit(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    const chars = Array.from(text);
    while (chars.length && ctx.measureText(chars.join("") + "…").width > maxWidth) chars.pop();
    return chars.join("") + "…";
}

// `url` must already be checked (lastfm.imageUrl only allows Last.fm's image CDN); no redirects, so it can't be sent elsewhere.
// Any failure just means no cover.
const loadCover = (url) => (url ? http.getBuffer(url, { timeoutMs: 5000, redirect: "error" }).then(loadImage).catch(() => null) : null);

/**
 * albums: { name, artist, image, plays }[], filled left to right. Returns a JPEG buffer
 * (JPEG keeps a 10x10 of photos well under Discord's upload limit).
 */
async function drawCollage(albums, { cols = 3, rows = 3, titles = true, plays = false } = {}) {
    const tile = Math.min(MAX_TILE, Math.floor(MAX_WIDTH / Math.max(cols, rows)));
    const shown = albums.slice(0, cols * rows);
    const canvas = createCanvas(cols * tile, rows * tile);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0a0619";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const covers = [];
    for (let i = 0; i < shown.length; i += AT_ONCE) covers.push(...await Promise.all(shown.slice(i, i + AT_ONCE).map((a) => loadCover(a.image))));

    const k = tile / MAX_TILE; // text scales with the tile
    shown.forEach((album, i) => {
        const x = (i % cols) * tile, y = Math.floor(i / cols) * tile;
        if (covers[i]) {
            ctx.drawImage(covers[i], x, y, tile, tile);
        } else {
            ctx.fillStyle = memberFor(album.name).color.hex; // no cover: a LOONA member colour instead
            ctx.fillRect(x, y, tile, tile);
        }
        if (!titles && !plays) return;
        // Dark fade at the bottom keeps the white text readable on any cover.
        const fade = ctx.createLinearGradient(0, y + tile * 0.55, 0, y + tile);
        fade.addColorStop(0, "rgba(0, 0, 0, 0)");
        fade.addColorStop(1, "rgba(0, 0, 0, 0.8)");
        ctx.fillStyle = fade;
        ctx.fillRect(x, y + tile * 0.55, tile, tile * 0.45);

        const lines = [];
        if (titles) lines.push([`bold ${Math.round(20 * k)}px`, "#ffffff", String(album.name ?? "")], [`${Math.round(16 * k)}px`, "rgba(255, 255, 255, 0.8)", String(album.artist ?? "")]);
        if (plays) lines.push([`${Math.round(15 * k)}px`, "rgba(255, 255, 255, 0.8)", `${Number(album.plays || 0).toLocaleString("en-US")} plays`]);
        let baseline = y + tile - Math.round(14 * k);
        for (const [size, colour, text] of lines.reverse()) {
            ctx.font = `${size} "${FONT}"`;
            ctx.fillStyle = colour;
            ctx.fillText(fit(ctx, text, tile - 24 * k), x + 12 * k, baseline);
            baseline -= Math.round(24 * k);
        }
    });
    return canvas.encode("jpeg", 90);
}

module.exports = { drawCollage, sizeFrom, MAX_SIDE };
