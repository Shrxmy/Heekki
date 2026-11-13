const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("a licensed font in the local folder takes over its role; other roles keep the bundled fonts", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heekki-fonts-"));
    fs.copyFileSync(path.join(__dirname, "..", "assets", "fonts", "Sacramento.ttf"), path.join(dir, "light.ttf")); // any real font file
    process.env.HEEKKI_LOCAL_FONTS = dir;
    const design = require("../lib/design");
    assert.strictEqual(design.font("light", 13, 300), '300 13px "Heekki light", "Noto Sans KR", "Noto Sans KR"');
    assert.strictEqual(design.font("sans", 20), '400 20px "Jost", "Noto Sans KR", "Noto Sans KR"');
    fs.rmSync(dir, { recursive: true });
});

test("the 이달의 소녀 wordmark is drawn even on the very first card a fresh process renders", async () => {
    process.env.DATABASE_URL = "memory";
    const pc = require("../lib/loona/photocards");
    const { loadImage, createCanvas } = require("@napi-rs/canvas");
    const image = await loadImage(await pc.renderPhotocard(pc.card(require("../lib/loona").findMember("heejin"), pc.RARITIES[0])));
    const ctx = createCanvas(image.width, image.height).getContext("2d");
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(150, 82, 160, 30); // where the wordmark sits, left of her name
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 80 && data[i + 1] < 80 && data[i + 2] < 80) dark++;
    assert.ok(dark > 300, `only ${dark} dark pixels: the wordmark is missing`);
});
