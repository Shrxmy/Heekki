// Downloads each photocard's scan from Savvi's LOONA Scans (Google Drive, per lib/loona/photocard-scans.json), trims
// the scanner margin and the card's rounded corners, shrinks it to 600px wide and uploads it to the Neon "assets" bucket.
// Run once after changing the manifest:  node --env-file=.env scripts/upload-photocard-scans.js [card-id ...]
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const storage = require("../lib/storage");
const { scanKey } = require("../lib/loona/photocards");
const { cards } = require("../lib/loona/photocard-scans.json");

const WIDTH = 600, INSET = 0.035; // inset past the rounded corners

async function download(driveId) {
    const res = await fetch(`https://drive.google.com/uc?export=download&id=${driveId}`, { signal: AbortSignal.timeout(90_000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) throw new Error(`Drive returned ${res.status} ${type}`);
    return Buffer.from(await res.arrayBuffer());
}

/** The card's area inside the scan: rows/columns that are mostly not scanner-white. */
function contentBox(img) {
    const w = 300, h = Math.round((img.height / img.width) * w);
    const ctx = createCanvas(w, h).getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const ink = (x, y) => { const i = (y * w + x) * 4; return Math.min(data[i], data[i + 1], data[i + 2]) < 225; };
    const rowInk = (y) => { let n = 0; for (let x = 0; x < w; x++) n += ink(x, y); return n > w / 2; };
    const colInk = (x) => { let n = 0; for (let y = 0; y < h; y++) n += ink(x, y); return n > h / 2; };
    let top = 0, bottom = h - 1, left = 0, right = w - 1;
    while (top < h / 3 && !rowInk(top)) top++;
    while (bottom > (h * 2) / 3 && !rowInk(bottom)) bottom--;
    while (left < w / 3 && !colInk(left)) left++;
    while (right > (w * 2) / 3 && !colInk(right)) right--;
    const s = img.width / w, bw = (right - left) * s, bh = (bottom - top) * s;
    return { x: left * s + bw * INSET, y: top * s + bh * INSET, w: bw * (1 - 2 * INSET), h: bh * (1 - 2 * INSET) };
}

async function prepare(scan) {
    const img = await loadImage(scan);
    const box = contentBox(img);
    const canvas = createCanvas(WIDTH, Math.round((box.h / box.w) * WIDTH));
    canvas.getContext("2d").drawImage(img, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);
    return canvas.encode("jpeg", 88);
}

(async () => {
    const only = process.argv.slice(2);
    const ids = only.length ? only : Object.keys(cards);
    let failed = 0;
    for (const id of ids) {
        try {
            if (!cards[id]) throw new Error("not in the manifest");
            const jpeg = await prepare(await download(cards[id].drive));
            await storage.put(scanKey(id), jpeg, "image/jpeg");
            console.log(`ok   ${id} (${Math.round(jpeg.length / 1024)} KB)`);
        } catch (err) {
            failed++;
            console.error(`FAIL ${id}: ${err.message}`);
        }
        await new Promise((r) => setTimeout(r, 1500)); // be gentle with Google Drive
    }
    console.log(`${ids.length - failed}/${ids.length} uploaded`);
    process.exitCode = failed ? 1 : 0;
})();
