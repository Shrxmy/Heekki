process.env.DATABASE_URL = "memory";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "commands");
const commands = fs.readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith(".js"))
    .map((f) => require(path.join(dir, f)))
    .filter((c) => c.name);

test("no two commands share a name or alias (otherwise one silently shadows the other)", async () => {
    const seen = new Map();
    for (const c of commands) for (const key of [c.name, ...(c.aliases ?? [])].map((k) => k.toLowerCase())) {
        assert.ok(!seen.has(key) || seen.get(key) === c.name, `"${key}" is used by both ${seen.get(key)} and ${c.name}`);
        seen.set(key, c.name);
    }
});

test("command names are unique and volume no longer overrides seek", async () => {
    const names = commands.map((c) => c.name);
    assert.deepStrictEqual(names, [...new Set(names)]);
    assert.ok(names.includes("volume") && names.includes("seek"));
});

test("per-guild prefix falls back to the default", async () => {
    const { getPrefix, setPrefix, getCustomPrefix } = require("../lib/db");
    assert.strictEqual(await getPrefix("g1"), "-");
    assert.strictEqual(await getCustomPrefix("g1"), null);
    await setPrefix("g1", "!");
    await setPrefix("g1", "?");
    assert.strictEqual(await getPrefix("g1"), "?");
    assert.strictEqual(await getPrefix("g2"), "-");
});

test("music clock/createBar", async () => {
    const { clock, createBar } = require("../lib/music/embed");
    assert.strictEqual(clock(59_999), "0:59");
    assert.strictEqual(clock(3_725_000), "1:02:05");
    const player = (position, info) => ({ position, queue: { current: info && { info } } });
    assert.strictEqual(createBar(player(30_000, { duration: 60_000, isStream: false })), "`0:30` ▬▬▬▬▬▬▬🔘▬▬▬▬▬▬ `1:00`");
    assert.match(createBar(player(60_000, { duration: 60_000, isStream: false })), /▬{13}🔘 `1:00`/u); // knob stays on the bar at the end
    assert.match(createBar(player(5_000, { duration: 0, isStream: true })), /LIVE/);
    assert.match(createBar(player(0, null)), /`0:00` 🔘▬+ `0:00`/u);
});

test("music cards are hosted by one LOONA member per song, in her colour", async () => {
    const { djFor, trackEmbed } = require("../lib/music/embed");
    const { members } = require("../lib/loona");
    const track = (identifier) => ({ info: { identifier, title: "Butterfly", uri: "https://youtu.be/x", author: "LOONA", duration: 223_000 },
        requester: { username: "orbit", globalName: "Orbit", displayAvatarURL: () => "https://cdn.discordapp.com/a.png" } });
    assert.strictEqual(djFor(track("abc")), djFor(track("abc")), "same song, same host");
    assert.ok(new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => djFor(track(id)).name)).size > 1, "different songs get different hosts");
    const dj = djFor(track("abc"));
    const card = trackEmbed(track("abc"), "is playing").toJSON();
    assert.strictEqual(card.color, parseInt(dj.color.hex.slice(1), 16));
    assert.strictEqual(card.author.name, `${dj.animal.split(" ")[0]} ${dj.name} is playing`);
    assert.strictEqual(card.footer.text, "For Orbit");
    assert.ok(members.includes(dj));
});
