// Custom greeting backgrounds: only Discord-hosted images, downloaded once and stored as a 1024x400 PNG.
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { WIDTH, HEIGHT } = require("./card");

const ALLOWED_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;
// A small compressed file can still decode to gigabytes, so the pixel count is checked from the header first.
const MAX_PIXELS = 25_000_000;

const ERRORS = {
    host: "Only Discord image uploads or Discord image links are allowed.",
    type: "That link didn't return a PNG, JPEG or WebP image.",
    size: "That image is over 8 MB.",
    download: "I couldn't download that image.",
    pixels: "That image is too large (over 25 megapixels).",
};

/** https only, Discord's CDN only, no embedded login. Stops the bot from being pointed at other servers. */
function isAllowedImageUrl(url) {
    let parsed;
    try { parsed = new URL(url); } catch { return false; }
    return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname) && !parsed.username && !parsed.password;
}

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** Width and height read from a PNG, JPEG or WebP header without decoding the image; null if unrecognised. */
function imageSize(buf) {
    try {
        if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString("ascii", 12, 16) === "IHDR")
            return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };

        if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) { // JPEG: walk segments to the frame header
            let i = 2;
            while (i + 9 < buf.length) {
                if (buf[i] !== 0xff) return null;
                const marker = buf[i + 1];
                if (marker === 0xff) { i++; continue; } // fill byte
                if (SOF_MARKERS.has(marker)) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
                i += 2 + buf.readUInt16BE(i + 2);
            }
            return null;
        }

        if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
            const chunk = buf.toString("ascii", 12, 16);
            if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
            if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
            if (chunk === "VP8L") {
                const bits = buf.readUInt32LE(21);
                return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
            }
        }
    } catch {
        // truncated header
    }
    return null;
}

async function readCapped(body) {
    const chunks = [];
    let total = 0;
    for await (const chunk of body) {
        total += chunk.length;
        if (total > MAX_BYTES) throw new Error(ERRORS.size);
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

/** Scales the image to cover 1024x400 and centre-crops it. */
async function normalize(bytes) {
    const image = await loadImage(bytes);
    const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
    const w = image.width * scale, h = image.height * scale;
    const canvas = createCanvas(WIDTH, HEIGHT);
    canvas.getContext("2d").drawImage(image, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
    return canvas.encode("png");
}

/** Rejects with an Error whose message can be shown to the admin as-is. */
async function downloadBackground(url, fetchImpl = fetch) {
    if (!isAllowedImageUrl(url)) throw new Error(ERRORS.host);

    let res;
    try {
        // A redirect could lead away from Discord's CDN, so refuse it.
        res = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(10_000) });
    } catch {
        throw new Error(ERRORS.download);
    }
    if (!res.ok || !res.body) throw new Error(ERRORS.download);

    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(type)) throw new Error(ERRORS.type);
    if (Number(res.headers.get("content-length")) > MAX_BYTES) throw new Error(ERRORS.size);

    let bytes;
    try {
        bytes = await readCapped(res.body);
    } catch (err) {
        throw err.message === ERRORS.size ? err : new Error(ERRORS.download);
    }
    const size = imageSize(bytes);
    if (!size) throw new Error(ERRORS.type);
    if (size.width * size.height > MAX_PIXELS) throw new Error(ERRORS.pixels);
    try {
        return await normalize(bytes);
    } catch {
        throw new Error(ERRORS.type); // the server said image/*, but it isn't one we can read
    }
}

module.exports = { isAllowedImageUrl, downloadBackground, imageSize };
