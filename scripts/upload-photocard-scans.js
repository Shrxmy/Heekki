// Uploads every photocard image to the Neon "assets" bucket as WebP, shrunk to 600px wide:
// - LOONA: scans from Savvi's LOONA Scans (Google Drive, lib/loona/photocard-scans.json), with the scanner margin and
//   the card's rounded corners trimmed off;
// - other groups: the photo at each card's `url` in lib/cards/<group>.json (Wikimedia Commons, or a concept photo).
// Run after changing a manifest:  node --env-file=.env scripts/upload-photocard-scans.js [card-id or group ...]
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const storage = require("../lib/storage");
const { scanKey, GROUPS } = require("../lib/loona/photocards");

// card id -> { group, scan }: LOONA's scans and every other group's photos.
const cards = Object.fromEntries([...GROUPS.values()].flatMap((g) => Object.entries(g.images).map(([id, scan]) => [id, { group: g.key, scan }])));

const WIDTH = 600, INSET = 0.035; // inset past the rounded corners

async function download({ drive, url }) {
    const res = await fetch(url ?? `https://drive.google.com/uc?export=download&id=${drive}`,
        { signal: AbortSignal.timeout(90_000), headers: { "User-Agent": "Heekki/2.0 ( https://github.com/Shrxmy/Heekki )" } });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) throw new Error(`download returned ${res.status} ${type}`);
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

async function prepare(file, trim) {
    const img = await loadImage(file);
    const box = trim ? contentBox(img) : { x: 0, y: 0, w: img.width, h: img.height }; // photos have no scanner margin
    const canvas = createCanvas(WIDTH, Math.round((box.h / box.w) * WIDTH));
    canvas.getContext("2d").drawImage(img, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);
    return canvas.encode("webp", 80); // about half the size of JPEG 88, no visible difference at card size
}

(async () => {
    const only = process.argv.slice(2); // card ids, or group keys for all of a group's cards
    const ids = only.length ? Object.keys(cards).filter((id) => only.includes(id) || only.includes(cards[id].group)) : Object.keys(cards);
    let failed = 0;
    for (const id of ids) {
        try {
            if (!cards[id]) throw new Error("not in the manifest");
            const { scan, group } = cards[id];
            const webp = await prepare(await download(scan), group === "loona");
            await storage.put(scanKey(id), webp, "image/webp");
            console.log(`ok   ${id} (${Math.round(webp.length / 1024)} KB)`);
        } catch (err) {
            failed++;
            console.error(`FAIL ${id}: ${err.message}`);
        }
        await new Promise((r) => setTimeout(r, 1500)); // be gentle with Google Drive and Wikimedia
    }
    console.log(`${ids.length - failed}/${ids.length} uploaded`);
    process.exitCode = failed ? 1 : 0;
})();
