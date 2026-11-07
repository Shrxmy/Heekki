process.env.DB_PATH = ":memory:";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "commands");
const commands = fs.readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith(".js"))
    .map((f) => require(path.join(dir, f)))
    .filter((c) => c.name);

test("command names are unique and volume no longer overrides seek", () => {
    const names = commands.map((c) => c.name);
    assert.deepStrictEqual(names, [...new Set(names)]);
    assert.ok(names.includes("volume") && names.includes("seek"));
});

test("per-guild prefix falls back to the default", () => {
    const { getPrefix, setPrefix, getCustomPrefix } = require("../db");
    assert.strictEqual(getPrefix("g1"), "-");
    assert.strictEqual(getCustomPrefix("g1"), null);
    setPrefix("g1", "!");
    setPrefix("g1", "?");
    assert.strictEqual(getPrefix("g1"), "?");
    assert.strictEqual(getPrefix("g2"), "-");
});

test("nowplaying format/createBar", () => {
    const { format, createBar } = require("../commands/music/nowplaying");
    assert.strictEqual(format(59_999), "00:59 | 59 Seconds");
    assert.strictEqual(format(3_725_000), "01:02:05 | 3725 Seconds");
    const player = (position, info) => ({ position, queue: { current: info && { info } } });
    assert.match(createBar(player(30_000, { duration: 60_000, isStream: false })), /🔘{6}▬{6}.*00:00:30 \/ 00:01:00/su);
    assert.match(createBar(player(5_000, { duration: 0, isStream: true })), /LIVE/);
    assert.match(createBar(player(0, null)), /00:00:00 \/ 00:00:00/);
});
