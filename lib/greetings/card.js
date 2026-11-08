// Draws the LOONA "twelve stars" welcome/leave card (approved mockup C).
const path = require("node:path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const FONT = "Noto Sans KR"; // bundled so Korean names never render as boxes, whatever the host has installed
GlobalFonts.registerFromPath(path.join(__dirname, "..", "..", "assets", "fonts", "NotoSansKR.ttf"), FONT);

const WIDTH = 1024, HEIGHT = 400;
const AVATAR = { x: 190, y: 200, r: 105 };
const RING_R = 150, STAR_R = 13;
const TEXT_X = 400, TEXT_MAX = 590;

// Fixed sky stars (positions as fractions) so every card looks the same.
const SKY_STARS = [[0.36, 0.12], [0.52, 0.08], [0.7, 0.18], [0.88, 0.1], [0.95, 0.42], [0.62, 0.86],
    [0.8, 0.78], [0.45, 0.92], [0.04, 0.1], [0.06, 0.9], [0.33, 0.8], [0.92, 0.9]];

/** Shortens text with "…" until it fits maxWidth in the current font. */
function fit(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    const chars = Array.from(text);
    while (chars.length && ctx.measureText(chars.join("") + "…").width > maxWidth) chars.pop();
    return chars.join("") + "…";
}

async function loadAvatar(avatarURL) {
    if (!avatarURL) return null;
    try {
        const res = await fetch(avatarURL, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        return await loadImage(Buffer.from(await res.arrayBuffer()));
    } catch {
        return null; // fall back to the drawn circle
    }
}

function drawBackground(ctx, background) {
    if (background) {
        ctx.drawImage(background, 0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "rgba(10, 6, 25, 0.45)"; // keeps white text readable on any image
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        return;
    }
    const sky = ctx.createRadialGradient(256, 200, 0, 256, 200, 800);
    sky.addColorStop(0, "#2b1d4f");
    sky.addColorStop(0.7, "#120c26");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    for (const [fx, fy] of SKY_STARS) {
        ctx.beginPath();
        ctx.arc(fx * WIDTH, fy * HEIGHT, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawOrbit(ctx, colors) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(AVATAR.x, AVATAR.y, RING_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    colors.forEach((color, i) => {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / colors.length; // first star at the top
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(AVATAR.x + RING_R * Math.cos(angle), AVATAR.y + RING_R * Math.sin(angle), STAR_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawAvatar(ctx, avatar, displayName) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(AVATAR.x, AVATAR.y, AVATAR.r, 0, Math.PI * 2);
    ctx.clip();
    if (avatar) {
        ctx.drawImage(avatar, AVATAR.x - AVATAR.r, AVATAR.y - AVATAR.r, AVATAR.r * 2, AVATAR.r * 2);
    } else {
        const fill = ctx.createLinearGradient(AVATAR.x - AVATAR.r, AVATAR.y - AVATAR.r, AVATAR.x + AVATAR.r, AVATAR.y + AVATAR.r);
        fill.addColorStop(0, "#8fa7ff");
        fill.addColorStop(1, "#f5a3d9");
        ctx.fillStyle = fill;
        ctx.fillRect(AVATAR.x - AVATAR.r, AVATAR.y - AVATAR.r, AVATAR.r * 2, AVATAR.r * 2);
        ctx.fillStyle = "#2a1a4a";
        ctx.font = `bold 80px "${FONT}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(Array.from(displayName)[0]?.toUpperCase() ?? "?", AVATAR.x, AVATAR.y + 4);
    }
    ctx.restore();
}

function drawText(ctx, { displayName, count, line, colors }) {
    ctx.save();
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = `16px "${FONT}"`;
    ctx.letterSpacing = "2px";
    ctx.fillText(`MEMBER #${count.toLocaleString("en-US")}`, TEXT_X, 150);
    ctx.letterSpacing = "0px";

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 46px "${FONT}"`;
    ctx.fillText(fit(ctx, displayName, TEXT_MAX), TEXT_X, 205);

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = `26px "${FONT}"`;
    ctx.fillText(fit(ctx, line, TEXT_MAX), TEXT_X, 250);

    const bar = ctx.createLinearGradient(TEXT_X, 0, TEXT_X + 360, 0);
    colors.forEach((color, i) => bar.addColorStop(i / (colors.length - 1), color));
    ctx.fillStyle = bar;
    ctx.beginPath();
    ctx.roundRect(TEXT_X, 275, 360, 4, 2);
    ctx.fill();
    ctx.restore();
}

/**
 * @param {{ avatarURL: string|null, displayName: string, count: number, line: string, colors: string[], background: Buffer|null }} card
 * @returns {Promise<Buffer>} 1024x400 PNG
 */
async function renderCard({ avatarURL, displayName, count, line, colors, background }) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");
    const [avatar, bg] = await Promise.all([loadAvatar(avatarURL), background ? loadImage(background) : null]);
    drawBackground(ctx, bg);
    drawOrbit(ctx, colors);
    drawAvatar(ctx, avatar, displayName);
    drawText(ctx, { displayName, count, line, colors });
    return canvas.encode("png");
}

module.exports = { renderCard, WIDTH, HEIGHT };
