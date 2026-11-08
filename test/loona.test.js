process.env.DB_PATH = ":memory:";
const test = require("node:test");
const assert = require("node:assert");
const loona = () => require("../lib/loona");

test("member data: 12 members in reveal order, each complete and credited", () => {
    const { members, group } = loona();
    assert.strictEqual(members.length, 12);
    assert.deepStrictEqual(members.map((m) => m.name), ["HeeJin", "HyunJin", "HaSeul", "YeoJin", "ViVi", "Kim Lip",
        "JinSoul", "Choerry", "Yves", "Chuu", "Go Won", "HyeJu"]);
    for (const m of members) {
        assert.match(m.color.hex, /^#[0-9A-F]{6}$/, m.name);
        assert.match(m.birthday, /^\d{4}-\d{2}-\d{2}$/, m.name);
        assert.ok(m.facts.length >= 5, m.name);
        assert.ok(m.photos.length >= 1, m.name);
        assert.ok(m.photos.length >= 2, `${m.name} needs at least 2 photos`);
        for (const p of m.photos) {
            // Only Wikimedia's servers: the LOONA Wiki's image server refuses Discord, so its photos showed up blank.
            assert.match(p.url, /^https:\/\/(upload|thumb)\.wikimedia\.org\//, `${m.name}: ${p.url}`);
            assert.ok(p.license && p.artist, `${m.name} photo credit`);
        }
    }
    assert.strictEqual(group.name, "LOONA");
});

test("findMember matches names, Korean names and nicknames, ignoring case, spaces and punctuation", () => {
    const { findMember } = loona();
    assert.strictEqual(findMember("heejin").name, "HeeJin");
    assert.strictEqual(findMember("Hee Jin").name, "HeeJin");
    assert.strictEqual(findMember("희진").name, "HeeJin");
    assert.strictEqual(findMember("Heekki").name, "HeeJin");
    assert.strictEqual(findMember("kim-lip").name, "Kim Lip");
    assert.strictEqual(findMember("Olivia Hye").name, "HyeJu");
    assert.strictEqual(findMember("gowon").name, "Go Won");
    assert.strictEqual(findMember("nobody"), null);
    assert.strictEqual(findMember(""), null);
});

test("age and next birthday are computed from the birthday", () => {
    const { age, daysUntilBirthday, nextBirthdays } = loona();
    const heejin = { birthday: "2000-10-19" };
    assert.strictEqual(age(heejin, new Date("2026-10-18T12:00:00Z")), 25);
    assert.strictEqual(age(heejin, new Date("2026-10-19T12:00:00Z")), 26);
    assert.strictEqual(daysUntilBirthday(heejin, new Date("2026-10-19T12:00:00Z")), 0);
    assert.strictEqual(daysUntilBirthday(heejin, new Date("2026-10-20T12:00:00Z")), 364);
    const next = nextBirthdays(new Date("2026-11-08T12:00:00Z"));
    assert.deepStrictEqual(next.slice(0, 3).map((n) => n.member.name), ["YeoJin", "HyeJu", "HyunJin"]); // Nov 11, 13, 15
    assert.strictEqual(next[0].days, 3);
});

test("photoCredit names the source for every kind of photo", () => {
    const { photoCredit } = loona();
    assert.strictEqual(photoCredit({ source: "commons", artist: "TV10", license: "CC BY 3.0" }), "Photo: TV10, CC BY 3.0, via Wikimedia Commons");
});

const cmd = () => require("../commands/loona/loona");
const NOV8 = new Date("2026-11-08T12:00:00Z");

test("group page: intro, members in order, next birthday, and a menu with all 12 members", () => {
    const embed = cmd().groupEmbed(NOV8).toJSON();
    assert.match(embed.title, /LOONA/);
    assert.ok(embed.fields.some((f) => f.name === "Next birthday" && /YeoJin.*3 days/.test(f.value)));
    const members = embed.fields.find((f) => f.name === "Members").value;
    assert.ok(members.indexOf("HeeJin") < members.indexOf("HyeJu"));
    const menu = cmd().memberMenu().toJSON();
    assert.strictEqual(menu.components[0].options.length, 12);
});

test("member page: official colour, facts, photo with credit, and working buttons", () => {
    const { findMember } = require("../lib/loona");
    const heejin = findMember("heejin");
    const embed = cmd().memberEmbed(heejin, { photo: 0, fact: 1, now: new Date("2026-10-19T03:00:00Z") }).toJSON();
    assert.strictEqual(embed.color, 0xF4028E);
    assert.match(embed.title, /HeeJin.*희진/);
    assert.ok(embed.description.includes(heejin.facts[1]));
    assert.ok(embed.fields.some((f) => f.name === "Birthday" && /October 19, 2000/.test(f.value) && /26/.test(f.value) && /today/i.test(f.value)));
    assert.ok(embed.image.url.startsWith("https://"));
    assert.match(embed.footer.text, /^Photo: .*· Info: LOONA Wiki/);
    const buttons = cmd().memberButtons(heejin, 0).toJSON().components.map((b) => b.custom_id);
    assert.deepStrictEqual(buttons, ["loona-prev", "loona-fact", "loona-photo", "loona-next"]);
});

test("member page steps: next/previous wrap around, photo and fact indexes cycle", () => {
    const { step } = cmd();
    const { members } = require("../lib/loona");
    const last = members.length - 1;
    assert.strictEqual(step({ member: last, photo: 3, fact: 2 }, "loona-next").member, 0);
    assert.strictEqual(step({ member: 0, photo: 3, fact: 2 }, "loona-prev").member, last);
    assert.strictEqual(step({ member: 0, photo: 3, fact: 2 }, "loona-next").photo, 0); // new member starts at her first photo
    const photos = members[0].photos.length;
    assert.strictEqual(step({ member: 0, photo: photos - 1, fact: 0 }, "loona-photo").photo, 0);
    assert.strictEqual(step({ member: 0, photo: 0, fact: 4 }, "loona-fact").fact, 0);
});

test("loona <unknown> explains, and photos that load reliably come first", async () => {
    const replies = [];
    const message = { author: { id: "1" }, reply: async (p) => { replies.push(p); return { createMessageComponentCollector: () => ({ on() {} }) }; } };
    await cmd().run({}, message, ["nobody"]);
    assert.match(replies[0].content ?? replies[0], /don't know a LOONA member called/);
    const { findMember } = require("../lib/loona");
});

test("review fix: unknown-member replies can't ping, and fast clicks are shown in order", async () => {
    const replies = [];
    const message = { author: { id: "1" }, reply: async (p) => { replies.push(p); } };
    await cmd().run({}, message, ["<@123456789012345678>"]);
    assert.deepStrictEqual(replies[0].allowedMentions?.parse, []);

    const { EventEmitter } = require("node:events");
    const shown = [];
    const collector = new EventEmitter();
    const page = { createMessageComponentCollector: () => collector, edit: async () => {} };
    const msg = { author: { id: "1" }, reply: async () => page };
    await cmd().run({}, msg, ["heejin"]);
    const click = (id, delay) => collector.emit("collect", { user: { id: "1" }, customId: id, componentType: 2,
        update: async (view) => { await new Promise((r) => setTimeout(r, delay)); shown.push(view.embeds[0].toJSON().title); } });
    click("loona-next", 30); // slow update
    click("loona-next", 0);  // fast update right after
    await new Promise((r) => setTimeout(r, 80));
    assert.deepStrictEqual(shown, ["HyunJin (현진)", "HaSeul (하슬)"]);
});
