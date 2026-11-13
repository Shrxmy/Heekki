// Draws the join/leave card in the style of LOONA's "Who's Next Girl?" teasers: a soft photo, 이달의 소녀 in bold
// black, the new member's name in the white box, then the line and date in a member colour.
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const design = require("../design");
const { koreaDate } = require("../loona");

const WIDTH = 1024, HEIGHT = 400;
const TEXT_X = 56, TEXT_MAX = 560;
const PHOTO = { x: 724, y: 36, w: 252, h: 328 };

async function loadAvatar(avatarURL) {
    if (!avatarURL) return null;
    try {
        const res = await fetch(avatarURL, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        return await loadImage(Buffer.from(await res.arrayBuffer()));
    } catch {
        return null; // fall back to her colour and initial
    }
}

/** The photo behind everything: the server's background, else the avatar blown up and blurred, else paper. */
function drawBackdrop(ctx, background, avatar, color) {
    if (background || avatar) {
        ctx.save();
        if (!background) ctx.filter = "blur(22px) saturate(0.8)";
        design.cover(ctx, background ?? avatar, -30, -30, WIDTH + 60, HEIGHT + 60, { anchorY: 0.3 });
        ctx.restore();
    } else {
        design.paper(ctx, WIDTH, HEIGHT);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.18;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.globalAlpha = 1;
    }
    // A wash of album paper from the left keeps the black type readable on any photo, as on the teasers.
    const wash = ctx.createLinearGradient(0, 0, WIDTH * 0.75, 0);
    wash.addColorStop(0, "rgba(236, 231, 223, 0.92)");
    wash.addColorStop(0.55, "rgba(236, 231, 223, 0.6)");
    wash.addColorStop(1, "rgba(236, 231, 223, 0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    design.grain(ctx, WIDTH, HEIGHT, 0.04);
}

/** The member's photo in a window on the right, lying on the page like the solo-album photos. */
function drawPhoto(ctx, avatar, displayName, color) {
    const { x, y, w, h } = PHOTO;
    ctx.save();
    ctx.shadowColor = "rgba(30, 20, 10, 0.3)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#F7F4EE";
    ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
    ctx.restore();
    if (avatar) {
        design.cover(ctx, avatar, x, y, w, h);
    } else {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.font = design.font("script", 170);
        ctx.textAlign = "center";
        ctx.fillText(Array.from(displayName)[0]?.toUpperCase() ?? "?", x + w / 2, y + h / 2 + 50);
        ctx.textAlign = "left";
    }
}

function drawText(ctx, { displayName, count, line, color }) {
    const text = design.onPaper(color); // light member colours (ViVi, Chuu) are darkened a little so they read
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = design.INK;
    ctx.font = design.font("korean", 66, 700);
    ctx.fillText("이달의", TEXT_X, 104);
    ctx.fillText("소녀", TEXT_X, 176);

    // The white name box: blank on the teasers, here it reveals who joined.
    ctx.font = design.font("sans", 32, 600);
    const name = design.fit(ctx, displayName, TEXT_MAX - 32);
    const boxW = Math.max(180, ctx.measureText(name).width + 32);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(TEXT_X, 198, boxW, 54);
    ctx.fillStyle = design.INK;
    ctx.fillText(name, TEXT_X + 16, 236);

    ctx.fillStyle = text;
    ctx.font = design.font("sans", 27, 700);
    ctx.fillText(design.fit(ctx, line, TEXT_MAX), TEXT_X, 298);
    const { y, m, d } = koreaDate(new Date());
    const date = `Nº${count.toLocaleString("en-US")}  ·  ${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
    ctx.font = design.font("sans", 24, 600);
    ctx.fillText(date, TEXT_X, 334);
    design.rule(ctx, TEXT_X, TEXT_X + ctx.measureText(date).width, 340, text, 2);
}

/**
 * @param {{ avatarURL: string|null, displayName: string, count: number, line: string, colors: string[], background: Buffer|null }} card
 * The colour follows the member count through the server's 12 colours, the way each teaser had her own.
 * @returns {Promise<Buffer>} 1024x400 PNG
 */
async function renderCard({ avatarURL, displayName, count, line, colors, background }) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");
    const color = colors[(Math.max(1, count) - 1) % colors.length];
    const [avatar, bg] = await Promise.all([loadAvatar(avatarURL), background ? loadImage(background) : null]);
    drawBackdrop(ctx, bg, avatar, color);
    drawPhoto(ctx, avatar, displayName, color);
    drawText(ctx, { displayName, count, line, color });
    return canvas.encode("png");
}

module.exports = { renderCard, WIDTH, HEIGHT };
