process.env.DATABASE_URL = "memory";
const test = require("node:test");
const assert = require("node:assert");

test("text tricks: emojify, fliptext, enchant, zalgo", async () => {
    const { emojify, flipText, enchant, zalgo } = require("../lib/fun/text");
    assert.strictEqual(emojify("Hi 1!"), "🇭 🇮   1️⃣ !");
    assert.strictEqual(flipText("hello"), "ollǝɥ");
    assert.strictEqual(enchant("abc"), "ᔑʖᓵ");
    const z = zalgo("orbit");
    assert.ok(z.startsWith("o") && z.length > "orbit".length && z.normalize("NFD").replace(/\p{M}/gu, "") === "orbit");
    assert.ok(zalgo("x".repeat(5000)).length <= 1900);
    assert.ok(emojify("a".repeat(5000)).length <= 1900);
});

test("decode understands binary and base64, and says when it can't", async () => {
    const { decode } = require("../lib/fun/text");
    assert.strictEqual(decode("01001100 01001111 01001111 01001110 01000001"), "LOONA");
    assert.strictEqual(decode("T3JiaXQ="), "Orbit");
    assert.strictEqual(decode("%%% definitely not encoded %%%"), null);
});

test("ratings are stable for the same person, kind and day, and stay within 0-100", async () => {
    const { rating, loveScore } = require("../lib/fun/rate");
    const day = new Date("2026-11-08T12:00:00Z");
    assert.strictEqual(rating("cute", "111", day), rating("cute", "111", day));
    for (let i = 0; i < 200; i++) { const r = rating("smart", String(i), day); assert.ok(r >= 0 && r <= 100); }
    assert.strictEqual(loveScore("1", "2", day), loveScore("2", "1", day)); // order doesn't matter
});

test("slots: payouts follow the table, and streaks keep long runs under 100% paid back", async () => {
    const { SYMBOLS, payout, JACKPOT, isCombo, STREAK_CAP } = require("../lib/fun/slots");
    const [a, b, c] = SYMBOLS;
    assert.strictEqual(payout([a, b, c], 10), 0);
    assert.strictEqual(payout([a, JACKPOT, c], 10), 10); // a lone moon: bet back
    assert.strictEqual(payout([a, a, c], 10), 20);
    assert.strictEqual(payout([a, a, JACKPOT], 10), 20); // an animal pair beats the lone moon
    assert.strictEqual(payout([JACKPOT, b, JACKPOT], 10), 70);
    assert.strictEqual(payout([a, a, a], 10), 200);
    assert.strictEqual(payout([JACKPOT, JACKPOT, JACKPOT], 10), 1500);
    assert.ok(isCombo([a, a, c]) && !isCombo([a, JACKPOT, c]));
    // Exact long-run return for n spins in one go, over every reel combination and streak.
    const all = [];
    for (const x of SYMBOLS) for (const y of SYMBOLS) for (const z of SYMBOLS) all.push({ p: payout([x, y, z], 1), combo: isCombo([x, y, z]) });
    const rtp = (n) => {
        let dist = new Map([[0, 1]]), total = 0;
        for (let i = 0; i < n; i++) {
            const next = new Map();
            for (const [streak, pr] of dist) for (const { p, combo } of all) {
                const s = combo ? streak + 1 : 0;
                total += (pr / all.length) * (s ? 1 + (p - 1) * Math.min(s, STREAK_CAP) : p);
                next.set(s, (next.get(s) ?? 0) + pr / all.length);
            }
            dist = next;
        }
        return total / n;
    };
    assert.strictEqual(rtp(1).toFixed(3), "0.866");
    assert.strictEqual(rtp(5).toFixed(3), "0.961");
    assert.strictEqual(rtp(10).toFixed(3), "0.976");
});

test("slots: streaks double then triple the winnings of combos in a row, and a miss or lone moon resets them", (t) => {
    const slots = require("../lib/fun/slots");
    const [a, b, c] = slots.SYMBOLS, M = slots.JACKPOT;
    const reels = [[a, a, c], [b, b, c], [c, c, a], [a, a, b], [a, b, c], [a, a, c], [a, M, b], [b, b, c]];
    t.mock.method(slots, "spin", () => reels.shift());
    const r = slots.playSpins(8, 10);
    assert.deepStrictEqual(r.map((x) => x.won), [20, 30, 40, 40, 0, 20, 10, 20]); // pair +10, ×2 +20, ×3 +30, capped, …
    assert.deepStrictEqual(r.map((x) => x.streak), [1, 2, 3, 4, 0, 1, 0, 1]);
});

test("moon coins: start at 500 per server, save, refuse overspending, and refill a broke player to 100", async () => {
    const { getCoins, betCoins } = require("../lib/db");
    assert.strictEqual(await getCoins("g", "u"), 500);
    assert.strictEqual(await betCoins("g", "u", 458, 0), 42);
    assert.strictEqual(await getCoins("g", "u"), 42);
    assert.strictEqual(await getCoins("other", "u"), 500);
    assert.strictEqual(await betCoins("g", "u", 43, 0), null); // can't bet more than you have
    assert.strictEqual(await betCoins("g", "u", 42, 0), 0);
    assert.strictEqual(await getCoins("g", "u"), 100);
    assert.strictEqual(await betCoins("g", "u", 100, 30), 30); // the bailout counts as the balance
    // Two spins at once can't both spend the same coins.
    const both = await Promise.all([betCoins("g", "u", 20, 0), betCoins("g", "u", 20, 0)]);
    assert.deepStrictEqual(both.sort(), [10, null]);
});

test("snipes keep only the latest message per channel, skip bots and empty text, and expire after 15 minutes", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
    const { remember, recall } = require("../lib/fun/snipes");
    const msg = (content, bot = false) => ({ channelId: "c", content, author: { bot, tag: "heekki", displayAvatarURL: () => "" }, createdTimestamp: Date.now() });
    remember("deleted", msg("first"));
    remember("deleted", msg("second"));
    remember("deleted", msg("from a bot", true));
    remember("deleted", msg(""));
    assert.strictEqual(recall("deleted", "c").content, "second");
    assert.strictEqual(recall("edited", "c"), null);
    t.mock.timers.tick(15 * 60_000 + 1);
    assert.strictEqual(recall("deleted", "c"), null);
});

const funCmd = (name) => require(`../commands/fun/${name}.js`);
function fakeMsg({ guildId = "fg", userId = "u1", members = {} } = {}) {
    const replies = [];
    const member = { id: userId, displayName: "Heekki" };
    const message = {
        guild: { id: guildId, members: { fetch: async (id) => members[id] ?? Promise.reject(new Error("Unknown Member")) } },
        member, author: { id: userId }, channel: { id: "c" },
        reply: async (p) => { replies.push(p); return { edit: async (q) => replies.push(q) }; },
    };
    return { message, replies };
}
const textOf = (p) => (typeof p === "string" ? p : p.content ?? p.embeds?.[0]?.toJSON().description ?? "");

test("slots: N spins in one go, bets settled at once, and refusals for bad counts or too few coins", async (t) => {
    const slots = require("../lib/fun/slots");
    const { getCoins } = require("../lib/db");
    const { message, replies } = fakeMsg({ guildId: "s1" });
    await funCmd("slots").run({}, message, ["5", "101"]); // 505 coins needed, 500 owned
    assert.match(textOf(replies[0]), /5 spins of 101 cost \*\*505\*\* moon coins, and you have \*\*500\*\*/);
    await funCmd("slots").run({}, message, ["50"]);
    assert.match(textOf(replies.at(-1)), /Spin 1 to 10 times/);
    await funCmd("slots").run({}, message, ["1", "abc"]);
    assert.match(textOf(replies.at(-1)), /whole number/);
    assert.strictEqual(await getCoins("s1", "u1"), 500);

    t.mock.method(slots, "spin", () => ["🐰", "🐱", "🐸"]); // no match: lose the bet
    await funCmd("slots").run({}, message, ["1", "100"]);
    assert.strictEqual(await getCoins("s1", "u1"), 400);
    slots.spin.mock.mockImplementation(() => ["🌙", "🌙", "🌙"]); // jackpot every time: x150, then streak x2, x3
    await funCmd("slots").run({}, message, ["3"]);
    assert.strictEqual(await getCoins("s1", "u1"), 400 - 30 + 1500 + (10 + 1490 * 2) + (10 + 1490 * 3));
    assert.match(textOf(replies.at(-1)), /streak ×3/);
    await funCmd("slots").run({}, message, []); // no args: one spin of 10
    assert.match(textOf(replies.at(-1)), /^## /);
});

test("snipe shows the remembered message, or says there's nothing", async () => {
    const { remember } = require("../lib/fun/snipes");
    const { message, replies } = fakeMsg();
    message.channel.id = "snipe-chan";
    await funCmd("snipe").run({}, message, []);
    assert.strictEqual(textOf(replies[0]), "There's nothing to snipe here.");
    remember("deleted", { channelId: "snipe-chan", content: "oops", author: { bot: false, tag: "chuu", displayAvatarURL: () => "" } });
    await funCmd("snipe").run({}, message, []);
    assert.strictEqual(textOf(replies[1]), "oops");
    await funCmd("snipeedit").run({}, message, []);
    assert.strictEqual(textOf(replies[2]), "There's nothing to snipe here.");
});

test("echo commands never ping, even when the text contains mentions", async () => {
    for (const name of ["emojify", "enchant", "fliptext", "zalgo", "decode"]) {
        const { message, replies } = fakeMsg();
        const input = name === "decode" ? [Buffer.from("@everyone <@123>").toString("base64")] : ["@everyone", "<@123>"];
        await funCmd(name).run({}, message, input);
        assert.deepStrictEqual(replies[0].allowedMentions?.parse, [], name);
    }
    const { message, replies } = fakeMsg();
    await funCmd("decode").run({}, message, ["zz", "not", "base64!"]);
    assert.strictEqual(textOf(replies[0]), "That doesn't look like binary or base64.");
});

test("love-calculator needs two different people", async () => {
    const other = { id: "u2", displayName: "Yves" };
    const { message, replies } = fakeMsg({ members: { "222222222222222222": other } });
    await funCmd("love-calculator").run({}, message, []);
    assert.match(textOf(replies[0]), /Mention someone/);
    await funCmd("love-calculator").run({}, message, ["<@222222222222222222>"]);
    assert.match(textOf(replies[1]), /Yves.*Heekki.*\d+%/s);
    await funCmd("love-calculator").run({}, message, ["<@999999999999999999>"]);
    assert.strictEqual(textOf(replies[2]), "I couldn't find that member.");
});

test("hack is clearly a joke and walks through its steps without pinging", async (t) => {
    const hack = funCmd("hack");
    t.mock.property(hack, "STEP_MS", 0);
    const victim = { id: "u3", displayName: "Kim Lip" };
    const { message, replies } = fakeMsg({ members: { "333333333333333333": victim } });
    await hack.run({}, message, ["<@333333333333333333>"]);
    assert.strictEqual(replies.length, 6);
    assert.match(textOf(replies.at(-1)), /It's a joke, nothing actually happened/);
    assert.ok(replies.every((r) => r.allowedMentions?.parse?.length === 0));
});

test("meme skips NSFW, spoiler and non-image posts", async () => {
    const { fetchMeme } = funCmd("meme");
    const posts = [
        { url: "https://i.redd.it/a.png", nsfw: true },
        { url: "https://evil.example/a.png", nsfw: false },
        { url: "https://i.redd.it/ok.png", nsfw: false, spoiler: false, title: "ok" },
    ];
    const fake = async () => new Response(JSON.stringify(posts.shift()), { headers: { "content-type": "application/json" } });
    assert.strictEqual((await fetchMeme("kpopmemes", fake)).url, "https://i.redd.it/ok.png");
    const allBad = async () => new Response(JSON.stringify({ url: "https://i.redd.it/x.png", nsfw: true }));
    assert.strictEqual(await fetchMeme("kpopmemes", allBad), null);
    assert.strictEqual(await fetchMeme("kpopmemes", async () => { throw new Error("down"); }), null);
});

test("review fix: expired snipes are actually dropped from memory, not just hidden", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: Date.now() }); // real "now", so earlier tests' snipes are in the past
    const { remember, count } = require("../lib/fun/snipes");
    const before = count();
    for (const c of ["x1", "x2", "x3"]) remember("deleted", { channelId: c, content: "old", author: { bot: false, tag: "a", displayAvatarURL: () => "" } });
    assert.strictEqual(count(), before + 3);
    t.mock.timers.tick(15 * 60_000 + 1);
    remember("deleted", { channelId: "x4", content: "new", author: { bot: false, tag: "a", displayAvatarURL: () => "" } });
    assert.strictEqual(count(), 1); // everything older than 15 minutes is gone
});

test("review fix: nicknames that look like mentions can't ping from rate or love replies", async () => {
    for (const [name, args] of [["cuterate", []], ["love-calculator", ["<@222222222222222222>"]]]) {
        const { message, replies } = fakeMsg({ members: { "222222222222222222": { id: "u2", displayName: "<@1234567890123456789>" } } });
        message.member.displayName = "<@&999999999999999999>";
        await funCmd(name).run({}, message, args);
        assert.deepStrictEqual(replies[0].allowedMentions?.parse, [], name);
    }
});

test("review fix: meme only accepts https image files and safe footer/link values", async () => {
    const { fetchMeme, memeEmbed } = funCmd("meme");
    const posts = [
        { url: "https://i.imgur.com/abc.gifv", nsfw: false },          // a video page, not an image
        { url: "http://i.redd.it/a.png", nsfw: false },                 // not https
        { url: "https://i.redd.it/ok.jpg", nsfw: false, title: "ok" },
    ];
    const fake = async () => new Response(JSON.stringify(posts.shift()));
    assert.strictEqual((await fetchMeme("kpopmemes", fake)).url, "https://i.redd.it/ok.jpg");
    const embed = memeEmbed({ url: "https://i.redd.it/ok.jpg", title: 123, subreddit: "x".repeat(5000), ups: "lots", postLink: "javascript:alert(1)" }).toJSON();
    assert.ok(embed.footer.text.length <= 100);
    assert.strictEqual(embed.url, undefined);
    assert.strictEqual(embed.title, "123");
});
