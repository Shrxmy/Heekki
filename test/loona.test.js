process.env.DATABASE_URL = "memory";
const test = require("node:test");
const assert = require("node:assert");
const loona = () => require("../lib/loona");

test("member data: 12 members in reveal order, each complete and credited", async () => {
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

test("findMember matches names, Korean names and nicknames, ignoring case, spaces and punctuation", async () => {
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

test("age and next birthday are computed from the birthday", async () => {
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

test("photoCredit names the source for every kind of photo", async () => {
    const { photoCredit } = loona();
    assert.strictEqual(photoCredit({ source: "commons", artist: "TV10", license: "CC BY 3.0" }), "Photo: TV10, CC BY 3.0, via Wikimedia Commons");
});

const cmd = () => require("../commands/loona/loona");
const NOV8 = new Date("2026-11-08T12:00:00Z");

test("group page: intro, members in order, next birthday, and a menu with all 12 members", async () => {
    const embed = cmd().groupEmbed(NOV8).toJSON();
    assert.match(embed.title, /LOONA/);
    assert.ok(embed.fields.some((f) => f.name === "Next birthday" && /YeoJin.*3 days/.test(f.value)));
    const members = embed.fields.find((f) => f.name === "Members").value;
    assert.ok(members.indexOf("HeeJin") < members.indexOf("HyeJu"));
    const menu = cmd().memberMenu().toJSON();
    assert.strictEqual(menu.components[0].options.length, 12);
});

test("member page: official colour, facts, photo with credit, and working buttons", async () => {
    const { findMember } = require("../lib/loona");
    const heejin = findMember("heejin");
    const embed = cmd().memberEmbed(heejin, { photo: 0, fact: 1, now: new Date("2026-10-19T03:00:00Z") }).toJSON();
    assert.strictEqual(embed.color, 0xF4028E);
    assert.match(embed.title, /HeeJin.*희진/);
    assert.ok(embed.description.includes(heejin.facts[1]));
    assert.ok(embed.fields.some((f) => f.name === "Birthday" && /October 19, 2000/.test(f.value) && /26/.test(f.value) && /today/i.test(f.value)));
    assert.ok(embed.fields.some((f) => f.name === "Instagram" && f.value === "[@0ct0ber19](https://www.instagram.com/0ct0ber19/)"));
    assert.ok(embed.image.url.startsWith("https://"));
    assert.match(embed.footer.text, /^Photo: .*· Info: LOONA Wiki/);
    const buttons = cmd().memberButtons(heejin, 0).toJSON().components.map((b) => b.custom_id);
    assert.deepStrictEqual(buttons, ["loona-prev", "loona-fact", "loona-photo", "loona-next"]);
});

test("member page steps: next/previous wrap around, photo and fact indexes cycle", async () => {
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

test("birthday posts: today's members, one post per server per year, retried after a failure", async () => {
    const { birthdaysToday, birthdayMessage, postBirthdays } = require("../lib/loona/birthdays");
    const { updateGreetSettings } = require("../lib/db");
    const HYEJU_DAY = new Date("2026-11-12T16:00:00Z"); // 01:00 on Nov 13 in Korea, still Nov 12 in UTC
    assert.deepStrictEqual(birthdaysToday(HYEJU_DAY).map((m) => m.name), ["HyeJu"]);
    assert.deepStrictEqual(birthdaysToday(NOV8), []);

    const msg = birthdayMessage(birthdaysToday(HYEJU_DAY)[0], HYEJU_DAY);
    assert.match(msg.content, /HyeJu.*turns 25/);
    assert.strictEqual(msg.embeds[0].toJSON().title, "HyeJu (혜주)");
    assert.deepStrictEqual(msg.allowedMentions, { parse: [] });

    const sent = [];
    let fail = true;
    const channel = { permissionsFor: () => ({ has: () => true }),
        send: async (m) => { if (fail) { fail = false; throw new Error("down"); } sent.push(m); } };
    const guild = (id) => ({ id, members: { me: {} }, channels: { cache: new Map([["c", channel]]) } });
    const client = { guilds: { cache: new Map([["b1", guild("b1")], ["b2", guild("b2")]]) } };
    await updateGreetSettings("b1", { channelId: "c" });
    await updateGreetSettings("b2", { channelId: "c", birthdayEnabled: false });

    const log = console.error; console.error = () => {};
    try { await postBirthdays(client, HYEJU_DAY); } finally { console.error = log; }
    assert.strictEqual(sent.length, 0); // the first send failed, so the claim was given back
    await postBirthdays(client, HYEJU_DAY);
    await postBirthdays(client, HYEJU_DAY);
    assert.strictEqual(sent.length, 1); // b1 once; b2 has them switched off
});

test("Instagram: every member but HyeJu links her personal account, with underscores escaped", () => {
    const { members, findMember } = loona();
    for (const m of members) {
        if (m.name === "HyeJu") assert.strictEqual(m.instagram, undefined);
        else assert.match(m.instagram, /^[a-z0-9._]{1,30}$/, m.name); // Instagram's username rules
    }
    const yeojin = cmd().memberEmbed(findMember("yeojin")).toJSON();
    assert.strictEqual(yeojin.fields.find((f) => f.name === "Instagram").value, "[@yeojin.\\_.o\\_x](https://www.instagram.com/yeojin._.o_x/)");
    assert.ok(!cmd().memberEmbed(findMember("hyeju")).toJSON().fields.some((f) => f.name === "Instagram"));
});

test("photocards: 48 cards, rarity odds add up, and sets count any rarity", () => {
    const pc = require("../lib/loona/photocards");
    assert.strictEqual(pc.ALL.length, 48);
    assert.strictEqual(new Set(pc.ALL.map((c) => c.id)).size, 48);
    assert.strictEqual(pc.RARITIES.reduce((sum, r) => sum + r.weight, 0), 100);
    for (const c of pc.ALL) { // every card has its scan and a credit naming the scanner
        assert.ok(c.scan?.from && c.scan.drive, c.id);
        assert.match(pc.credit(c), /^Scan: Savvi's LOONA Scans \(@pika_chuuves\) · /);
        assert.strictEqual(pc.scanKey(c.id), `photocards/${c.id}.jpg`);
    }
    assert.strictEqual(new Set(pc.ALL.map((c) => c.scan.drive)).size, 48, "48 different scans");
    assert.strictEqual(pc.roll(() => 0).rarity.key, "common");
    assert.strictEqual(pc.roll(() => 0.98).rarity.key, "moon");
    assert.strictEqual(pc.roll(() => 0.99999).member.name, "HyeJu");
    const sets = (ids) => pc.completedSets(ids).map((s) => s.key);
    assert.deepStrictEqual(sets(["kimlip-common", "jinsoul-moon", "choerry-rare"]), ["oec"]);
    assert.deepStrictEqual(sets(["kimlip-common", "jinsoul-moon"]), []);
    assert.deepStrictEqual(sets(pc.ALL.filter((c) => c.rarity.key === "common").map((c) => c.id)), ["1/3", "oec", "yyxy", "loona"]);
});

test("photocards: a card still draws when its scan isn't in storage", async () => {
    const pc = require("../lib/loona/photocards");
    const { loadImage } = require("@napi-rs/canvas");
    for (const rarity of pc.RARITIES) { // the test storage is empty, so this is the fallback for every label style
        const image = await loadImage(await pc.renderPhotocard(pc.card(loona().findMember("jinsoul"), rarity)));
        assert.deepStrictEqual([image.width, image.height], [600, 900]);
    }
});

test("pull: free once a day, then costs coins, refuses when broke, and pays a set bonus once", async (t) => {
    const pc = require("../lib/loona/photocards");
    const db = require("../lib/db");
    const pull = require("../commands/loona/pull");
    t.mock.method(pc, "renderPhotocard", async () => Buffer.from("png"));
    const replies = [];
    const message = { guild: { id: "pcg" }, author: { id: "pcu", displayAvatarURL: () => "" }, member: { displayName: "Orbit" },
        reply: async (p) => replies.push(p) };
    const desc = () => replies.at(-1).embeds[0].toJSON().description;

    const oec = ["kimlip", "jinsoul", "choerry"].map((k) => pc.card(loona().findMember(k), pc.RARITIES[0]));
    let next = 0;
    t.mock.method(pc, "roll", () => oec[next++]);
    await pull.run({}, message, []);
    assert.match(desc(), /New card!/);
    assert.match(desc(), /free pull/);
    assert.strictEqual(await db.getCoins("pcg", "pcu"), 500);
    assert.strictEqual(replies.at(-1).components[0].toJSON().components[0].url, "https://www.instagram.com/kimxxlip/");

    await pull.run({}, message, []);
    assert.match(desc(), /-150 moon coins/);
    await pull.run({}, message, []); // Choerry completes ODD EYE CIRCLE
    assert.match(desc(), /ODD EYE CIRCLE\*\* set complete! \+500/);
    assert.strictEqual(await db.getCoins("pcg", "pcu"), 500 - 150 - 150 + 500);

    t.mock.method(pc, "roll", () => oec[2]); // a duplicate doesn't pay the set again
    await pull.run({}, message, []);
    assert.match(desc(), /You now have 2 of this card/);
    assert.doesNotMatch(desc(), /set complete/);
    assert.strictEqual(await db.getCoins("pcg", "pcu"), 550);

    await db.betCoins("pcg", "pcu", 500, 0); // down to 50 coins
    const before = (await db.photocardsOf("pcg", "pcu")).size;
    await pull.run({}, message, []);
    assert.match(replies.at(-1), /costs \*\*150\*\* moon coins \(you have \*\*50\*\*\)/);
    assert.strictEqual((await db.photocardsOf("pcg", "pcu")).size, before);

    const hyeju = pc.card(loona().findMember("hyeju"), pc.RARITIES[0]);
    await db.betCoins("pcg", "pcu", 0, 1000);
    t.mock.method(pc, "roll", () => hyeju);
    await pull.run({}, message, []);
    assert.deepStrictEqual(replies.at(-1).components, []); // HyeJu: no Instagram button
});

test("collection: marks owned rarities and completed sets", () => {
    const { collectionEmbed } = require("../commands/loona/collection");
    const owned = new Map([["kimlip-common", 1], ["jinsoul-moon", 2], ["choerry-rare", 1]]);
    const embed = collectionEmbed({ id: "1", displayName: "Orbit_fan" }, owned).toJSON();
    assert.match(embed.description, /Kim Lip .*● ◇ ☆ 🌑/);
    assert.match(embed.description, /JinSoul .*○ ◇ ☆ 🌕/);
    assert.match(embed.description, /✅ ODD EYE CIRCLE/);
    assert.match(embed.description, /▫️ yyxy/);
    assert.strictEqual(embed.title, "Orbit\\_fan's photocards");
    assert.match(embed.footer.text, /^3\/48 cards · 4 pulled/);
});

test("pullPhotocard: one free pull a day even when pulls race, the day never moves back, and paying is all-or-nothing", async () => {
    const db = require("../lib/db");
    const both = await Promise.all([db.pullPhotocard("rg", "ru", "2026-11-14", 150, "chuu-moon"), db.pullPhotocard("rg", "ru", "2026-11-14", 150, "chuu-moon")]);
    assert.deepStrictEqual(both.map((p) => p.free).sort(), [false, true]);
    assert.strictEqual(await db.getCoins("rg", "ru"), 350);
    assert.strictEqual((await db.photocardsOf("rg", "ru")).get("chuu-moon"), 2);
    assert.strictEqual((await db.pullPhotocard("rg", "ru", "2026-11-13", 150, "yves-rare")).free, false); // late request from yesterday
    assert.strictEqual((await db.pullPhotocard("rg", "ru", "2026-11-15", 150, "yves-rare")).free, true);
    assert.strictEqual((await db.pullPhotocard("rg", "ru", "2026-11-15", 150, "yves-rare")).free, false); // 350 - 150 - 150 = 50 left
    assert.strictEqual(await db.pullPhotocard("rg", "ru", "2026-11-15", 150, "heejin-common"), null); // can't afford
    assert.strictEqual((await db.photocardsOf("rg", "ru")).has("heejin-common"), false);
    assert.strictEqual(await db.getCoins("rg", "ru"), 50);
    const bonus = await Promise.all([db.paySetBonus("rg", "ru", "oec", 500), db.paySetBonus("rg", "ru", "oec", 500)]);
    assert.deepStrictEqual(bonus.sort(), [false, true]);
    assert.strictEqual(await db.getCoins("rg", "ru"), 550);
});

test("pull: today's date is zero-padded so it sorts correctly", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-03-04T03:00:00Z") });
    assert.strictEqual(require("../commands/loona/pull").today(), "2026-03-04");
});

test("design: dark colours get white text on a highlight, and light ones are darkened to read on paper", () => {
    const design = require("../lib/design");
    assert.strictEqual(design.inkOn("#1313D6"), "#FFFFFF"); // JinSoul blue
    assert.strictEqual(design.inkOn("#FFCB07"), design.INK); // HyunJin yellow
    assert.strictEqual(design.onPaper("#1313D6"), "#1313d6"); // already dark: unchanged
    assert.strictEqual(design.onPaper("#F4028E"), "#f4028e"); // HeeJin pink reads fine as it is
    assert.ok(design.luminance(design.onPaper("#F4A1B5")) <= 0.23); // ViVi pink, darkened
});

test("song quiz: pool, answer matching, clip position and winners", () => {
    const g = require("../lib/loona/guess");
    assert.ok(g.songs.length >= 200);
    for (const s of g.songs) assert.ok(s.title && s.artist && s.release && Array.isArray(s.aliases), JSON.stringify(s));
    const song = (title, ...aliases) => ({ title, aliases, artist: "LOONA", release: "x" });
    const ohYes = song("Oh (Yes I Am)", "Oh", "Yes I Am");
    assert.ok(g.isCorrect("oh yes i am", ohYes) && g.isCorrect("Yes I Am!", ohYes) && g.isCorrect("OH", ohYes));
    assert.ok(g.isCorrect("키스는 다음에", song("Kiss Later", "키스는 다음에")) && g.isCorrect("kiss later", song("Kiss Later", "키스는 다음에")));
    assert.ok(g.isCorrect("buterfly", song("Butterfly"))); // one typo allowed from 6 letters
    assert.ok(!g.isCorrect("hi", song("Hi High")) && !g.isCorrect("", song("Hi High")));
    assert.ok(!g.isCorrect("365!", song("366"))); // short titles must be exact
    assert.ok(!g.isCorrect("the carol", song("The Carol 2.0")));
    assert.strictEqual(new Set(g.pickSongs(15).map((s) => s.title + s.artist)).size, 15);
    for (const r of [0, 0.5, 0.999]) {
        const start = g.clipStart(200_000, () => r);
        assert.ok(start >= 30_000 && start + g.CLIP_MS <= 200_000, `start ${start}`);
    }
    assert.strictEqual(g.clipStart(25_000, () => 0.999), 5_000); // a short song still fits the whole clip
    assert.deepStrictEqual(g.winners(new Map([["a", 3], ["b", 3], ["c", 1]])), ["a", "b"]);
    assert.deepStrictEqual(g.winners(new Map()), []);
    const butterfly = song("Butterfly");
    const yt = (title, author) => ({ title, author });
    assert.ok(g.resultMatches(yt("Butterfly (Official Audio)", "이달의 소녀 LOONA"), butterfly));
    assert.ok(!g.resultMatches(yt("Butterfly", "Cocomong"), butterfly)); // right title, wrong artist
    assert.ok(!g.resultMatches(yt("Unf/Air", "ARTMS"), { ...song("Light It Up"), artist: "ARTMS" }));
    assert.ok(g.resultMatches(yt("rendezvou 18.6y", "LOONA/yyxy"), { ...song("rendezvous 18.6y"), artist: "LOONA yyxy" })); // a typo on YouTube's side
    const goldfish = { ...song("Goldfish"), artist: "Yves" };
    assert.ok(g.resultMatches(yt("Goldfish", "Yves"), goldfish));
    assert.ok(!g.resultMatches(yt("Goldfish", "YVES H"), goldfish) && !g.resultMatches(yt("Goldfish", "tripleS"), goldfish));
    assert.ok(g.resultMatches(yt("Plastic Candy", "HaSeul (ARTMS)"), { ...song("Plastic Candy"), artist: "HaSeul" }));
    assert.ok(g.resultMatches(yt("I'll Be Your Spring", "HyeJu"), { ...song("I’LL BE YOUR SPRING"), artist: "Olivia Hye" }));
});

test("giftPhotocard gives a card without touching coins or the free pull", async () => {
    const db = require("../lib/db");
    assert.strictEqual(await db.giftPhotocard("gg", "gu", "yves-moon"), 1);
    assert.strictEqual(await db.giftPhotocard("gg", "gu", "yves-moon"), 2);
    assert.strictEqual(await db.getCoins("gg", "gu"), 500);
    assert.strictEqual((await db.pullPhotocard("gg", "gu", "2026-11-14", 150, "chuu-rare")).free, true);
});

test("guess: plays 10 clips, pays each round's winner, gives the top scorer a card, and cleans up", async (t) => {
    const g = require("../lib/loona/guess");
    const pc = require("../lib/loona/photocards");
    const db = require("../lib/db");
    const guess = require("../commands/loona/guess");
    t.mock.method(pc, "renderPhotocard", async () => Buffer.from("png"));
    g.BREAK_MS = 0;

    const plays = [], sent = [];
    let created = false, destroyed = false, current = null;
    const player = { set: (k, v) => { player[k] = v; }, connect: async () => {}, stopPlaying: async () => {},
        play: async (o) => { plays.push(o); current = o.clientTrack.info.title; }, destroy: async () => { destroyed = true; } };
    const client = { lavalink: { useable: true, getPlayer: () => (created && !destroyed ? player : undefined), createPlayer: () => { created = true; return player; },
        nodeManager: { leastUsedNodes: () => [{ search: async ({ query, source }) => {
            assert.strictEqual(source, "ytmsearch");
            return { tracks: [{ info: { title: `${query} (Official Audio)`, author: "이달의 소녀", length: 200_000 } }] };
        } }] } } };
    // Rounds 1 and 3: Orbit A guesses right; round 2: B; everything else: nobody.
    let round = 0;
    const answerFor = { 1: "qa", 2: "qb", 3: "qa" };
    const channel = { id: "c", send: async (p) => sent.push(p), awaitMessages: async ({ filter }) => {
        await new Promise((r) => setImmediate(r)); // answers arrive after the clip has started, as in Discord
        round++;
        const who = answerFor[round];
        const title = current.replace(/ \(Official Audio\)$/, "").split(" ").slice(1).join(" "); // drop the artist word(s)
        const song = g.songs.find((s) => current.startsWith(`${s.artist} ${s.title}`));
        const msg = { author: { id: who, bot: false }, content: song.title, react: async () => {} };
        assert.ok(title.length > 0);
        return { first: () => (who && filter(msg) ? msg : undefined) };
    } };
    const message = { guild: { id: "qg" }, author: { id: "qa" }, member: { voice: { channel: { id: "vc" } } }, channel,
        reply: async (p) => sent.push(p) };

    await guess.run(client, message, []);
    assert.strictEqual(plays.length, 10);
    for (const p of plays) assert.strictEqual(p.endTime - p.position, g.CLIP_MS);
    assert.strictEqual(player.guessGame, true);
    assert.strictEqual(await db.getCoins("qg", "qa"), 500 + 2 * g.COINS_PER_ROUND);
    assert.strictEqual(await db.getCoins("qg", "qb"), 500 + g.COINS_PER_ROUND);
    assert.strictEqual((await db.photocardsOf("qg", "qa")).size, 1); // the top scorer's prize
    assert.strictEqual((await db.photocardsOf("qg", "qb")).size, 0);
    assert.ok(sent.some((p) => p.embeds?.[0]?.toJSON().title === "Final scores"));
    assert.ok(destroyed);
    assert.strictEqual(guess.games.size, 0);
});

test("guess: stopping early ends without a prize, and never destroys a player the quiz doesn't own", async (t) => {
    const g = require("../lib/loona/guess");
    const db = require("../lib/db");
    const guess = require("../commands/loona/guess");
    g.BREAK_MS = 0;
    const sent = [];
    let destroyedOurs = false, current = null, round = 0;
    const ours = { set() {}, connect: async () => {}, stopPlaying: async () => {}, play: async (o) => { current = o.clientTrack.info.title; },
        destroy: async () => { destroyedOurs = true; } };
    const music = { destroy: async () => assert.fail("the quiz destroyed the music player") };
    let active = null; // which player Lavalink reports for this server
    const client = { lavalink: { useable: true, getPlayer: () => active, createPlayer: () => (active = ours),
        nodeManager: { leastUsedNodes: () => [{ search: async ({ query }) => ({ tracks: [{ info: { title: query, author: "LOONA", length: 200_000 } }] }) }] } } };
    const channel = { send: async (p) => sent.push(p), awaitMessages: async ({ filter }) => {
        await new Promise((r) => setImmediate(r)); // answers arrive after the clip has started, as in Discord
        round++;
        const song = g.songs.find((s) => current.startsWith(`${s.artist} ${s.title}`));
        const msg = { author: { id: "sa", bot: false }, content: song.title, react: async () => {} };
        if (round === 2) { await guess.run(client, message, ["stop"]); } // stop during round 2
        if (round === 3) active = music; // can't happen after a stop, but if it did, the quiz must leave it alone
        return { first: () => (filter(msg) ? msg : undefined) };
    } };
    const message = { guild: { id: "sg" }, author: { id: "sa" }, member: { voice: { channel: { id: "vc" } } }, channel, reply: async (p) => sent.push(p) };
    await guess.run(client, message, []);
    assert.strictEqual(round, 2); // round 2 was the last
    assert.strictEqual(await db.getCoins("sg", "sa"), 500 + 2 * g.COINS_PER_ROUND);
    assert.strictEqual((await db.photocardsOf("sg", "sa")).size, 0); // no card for a stopped game
    assert.ok(sent.some((p) => typeof p === "string" && /finishing all 10 rounds/.test(p)));
    assert.ok(destroyedOurs);

    // Our player replaced by someone else's mid-round: the quiz stops and leaves it alone.
    round = 0; destroyedOurs = false; active = null;
    channel.awaitMessages = async () => { active = music; return { first: () => undefined }; };
    await guess.run(client, message, []);
    assert.ok(!destroyedOurs);
    assert.strictEqual(guess.games.size, 0);
});
