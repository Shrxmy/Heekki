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
