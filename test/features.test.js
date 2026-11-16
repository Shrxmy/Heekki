process.env.DATABASE_URL = "memory";
const test = require("node:test");
const assert = require("node:assert");
const { createCanvas } = require("@napi-rs/canvas");

const db = require("../lib/db");
const pc = require("../lib/loona/photocards");
const storage = require("../lib/storage");

const A = "100000000000000001", B = "100000000000000002";
const cards = async (g, u) => Object.fromEntries(await db.photocardsOf(g, u));

test("trade: reads both sides, but not coins for coins", () => {
    const { parseOffer } = require("../commands/loona/trade");
    assert.deepStrictEqual(parseOffer("kim lip rare for chuu moon"), { give: { cardId: "kimlip-rare" }, get: { cardId: "chuu-moon" } });
    assert.deepStrictEqual(parseOffer("300 coins FOR twice nayeon super"), { give: { coins: 300 }, get: { cardId: "twice.nayeon-super" } });
    assert.deepStrictEqual(parseOffer("chuu moon for 50"), { give: { cardId: "chuu-moon" }, get: { coins: 50 } });
    assert.strictEqual(parseOffer("300 for 200"), null);
    assert.strictEqual(parseOffer("chuu moon"), null);
    assert.strictEqual(parseOffer("nobody rare for chuu moon"), null);
    assert.strictEqual(parseOffer("0 for chuu moon"), null);
});

test("tradePhotocards: swaps cards and coins together, or changes nothing", async () => {
    const g = "tg";
    await db.giftPhotocard(g, A, "kimlip-rare");
    await db.giftPhotocard(g, B, "chuu-moon");
    await db.giftPhotocard(g, B, "chuu-moon");
    assert.deepStrictEqual(await db.tradePhotocards(g, A, B, { cardId: "kimlip-rare" }, { cardId: "chuu-moon" }), { ok: true });
    assert.deepStrictEqual(await cards(g, A), { "chuu-moon": 1 }); // A's only Kim Lip is gone, not left at 0
    assert.deepStrictEqual(await cards(g, B), { "chuu-moon": 1, "kimlip-rare": 1 });

    // A no longer has Kim Lip: nothing moves, not even B's coins.
    assert.deepStrictEqual(await db.tradePhotocards(g, A, B, { cardId: "kimlip-rare" }, { coins: 100 }), { ok: false, missing: A });
    assert.deepStrictEqual(await cards(g, B), { "chuu-moon": 1, "kimlip-rare": 1 });
    assert.strictEqual(await db.getCoins(g, B), 500);

    // Coins for a card: B pays 120, A's Chuu moves.
    assert.deepStrictEqual(await db.tradePhotocards(g, A, B, { cardId: "chuu-moon" }, { coins: 120 }), { ok: true });
    assert.strictEqual(await db.getCoins(g, A), 620);
    assert.strictEqual(await db.getCoins(g, B), 380);
    assert.deepStrictEqual(await cards(g, B), { "chuu-moon": 2, "kimlip-rare": 1 });

    // B can't pay more than they have, and the card they'd have got stays put.
    assert.deepStrictEqual(await db.tradePhotocards(g, B, A, { coins: 381 }, { cardId: "chuu-moon" }), { ok: false, missing: B });
    // A broke player can't hand out the 100-coin bailout.
    await db.betCoins(g, B, 380, 0);
    assert.strictEqual(await db.getCoins(g, B), 100); // the bailout shows...
    assert.deepStrictEqual(await db.tradePhotocards(g, B, A, { coins: 100 }, { cardId: "chuu-moon" }), { ok: false, missing: B }); // ...but can't be traded
});

test("trade command: checks the offer up front, then only the other person can accept", async () => {
    const trade = require("../commands/loona/trade");
    const g = "tc";
    await db.giftPhotocard(g, A, "yves-rare");
    await db.giftPhotocard(g, B, "heejin-moon");
    const replies = [], handlers = {};
    const sent = { createMessageComponentCollector: () => ({ on: (ev, fn) => { handlers[ev] = fn; }, stop: () => {} }), edit: async () => {} };
    const message = { guild: { id: g, members: { fetch: async (id) => ({ user: { id, bot: false, username: "friend" } }) } }, author: { id: A },
        reply: async (p) => { replies.push(p); return sent; } };
    await trade.run({}, message, [`<@${B}>`, "yves rare for heejin moon"]);
    assert.match(replies[0].embeds[0].toJSON().description, /Yves · Rare[\s\S]*HeeJin · Moon/);
    const click = (user, customId) => { const out = {}; handlers.collect({ user: { id: user }, customId, reply: async (p) => { out.reply = p; }, update: async (p) => { out.update = p; } }); return out; };
    const own = click(A, "trade-accept");
    await new Promise((r) => setImmediate(r));
    assert.match(own.reply.content, /Only <@\d+> can accept/);
    const accepted = click(B, "trade-accept");
    await new Promise((r) => setTimeout(r, 50));
    assert.match(accepted.update.content, /Traded/);
    assert.deepStrictEqual(await cards(g, A), { "heejin-moon": 1 });

    await trade.run({}, message, [`<@${B}>`, "yves rare for heejin moon"]); // A gave Yves away
    assert.match(replies.at(-1), /don't have \*\*Yves · Rare\*\*/);
});

test("wishlist: up to the limit, and drops only ping wishers who don't have the card", async () => {
    const g = "wg";
    assert.strictEqual(await db.addWish(g, A, "chuu-moon", 2), true);
    assert.strictEqual(await db.addWish(g, A, "chuu-moon", 2), false);
    assert.strictEqual(await db.addWish(g, A, "yves-moon", 2), true);
    assert.strictEqual(await db.addWish(g, A, "gowon-moon", 2), false); // full
    await db.addWish(g, B, "chuu-moon", 2);
    await db.giftPhotocard(g, B, "chuu-moon");
    assert.deepStrictEqual(await db.wishersFor(g, "chuu-moon"), [A]);
    assert.strictEqual(await db.removeWish(g, A, "chuu-moon"), true);
    assert.deepStrictEqual(await db.wishesOf(g, A), ["yves-moon"]);
});

test("leaderboard: different cards, Moon cards, and coins, best first", async () => {
    const g = "lg";
    for (const id of ["chuu-moon", "chuu-moon", "yves-rare"]) await db.giftPhotocard(g, A, id);
    for (const id of ["heejin-moon", "vivi-moon", "gowon-common"]) await db.giftPhotocard(g, B, id);
    await db.betCoins(g, A, 0, 300);
    assert.deepStrictEqual(await db.leaderboard(g, "cards"), [{ userId: B, score: 3 }, { userId: A, score: 2 }]);
    assert.deepStrictEqual(await db.leaderboard(g, "moon"), [{ userId: B, score: 2 }, { userId: A, score: 1 }]);
    assert.deepStrictEqual(await db.leaderboard(g, "coins"), [{ userId: A, score: 800 }]);
});

test("playlists: save, replace by name (any case), list, load and delete, up to the limit", async () => {
    assert.strictEqual(await db.savePlaylist(A, "Chill", ["t1", "t2"], 2), true);
    assert.strictEqual(await db.savePlaylist(A, "gym", ["t3"], 2), true);
    assert.strictEqual(await db.savePlaylist(A, "party", ["t4"], 2), false); // full
    assert.strictEqual(await db.savePlaylist(A, "CHILL", ["t5"], 2), true); // replacing one is fine
    assert.deepStrictEqual(await db.playlistsOf(A), [{ name: "CHILL", count: 1 }, { name: "gym", count: 1 }]);
    assert.deepStrictEqual(await db.getPlaylist(A, "chill"), { name: "CHILL", tracks: ["t5"] });
    assert.strictEqual(await db.deletePlaylist(A, "Gym"), true);
    assert.strictEqual(await db.getPlaylist(A, "gym"), null);
});

test("binder: draws a group's grid, with or without the photos", async () => {
    const png = await pc.renderBinder("aespa", new Map([["aespa.karina-moon", 2]]));
    assert.deepStrictEqual([...png.subarray(1, 4)].map((b) => String.fromCharCode(b)).join(""), "PNG");
});

test("guess photo: the first right name wins coins, at most every 10 minutes", async (t) => {
    const guess = require("../commands/loona/guess");
    t.mock.method(Math, "random", () => 0); // LOONA, Common, HeeJin
    const photo = createCanvas(60, 90);
    await storage.put(pc.scanKey("heejin-common"), await photo.encode("png"));
    const sent = [];
    const play = (author) => guess.run({}, { guild: { id: "gp" }, author: { id: author }, reply: async (p) => { sent.push(p); },
        channel: { id: "c1", send: async (p) => { sent.push(p); }, awaitMessages: async ({ filter }) => {
            const msgs = [{ author: { id: author, bot: false }, content: "vivi", react: async () => {} }, { author: { id: author, bot: false }, content: "HeeJin!", react: async () => {} }];
            return { first: () => msgs.find(filter) };
        } } }, ["photo"]);
    await play(A);
    assert.strictEqual(sent[0].embeds[0].toJSON().title, "📸 Who's this?");
    assert.match(sent[1].content, new RegExp(`<@${A}> got it! \\+${guess.PHOTO_COINS} moon coins[\\s\\S]*HeeJin`));
    assert.strictEqual(await db.getCoins("gp", A), 500 + guess.PHOTO_COINS);
    await play(A);
    assert.match(sent[3].content, /more coins in 10 min/);
});

test("bias: gives the member's role in their colour and swaps out the old one", async () => {
    const bias = require("../commands/loona/bias");
    const roles = new Map(), mine = new Map();
    const cache = (m) => ({ find: (fn) => [...m.values()].find(fn), filter: (fn) => new Map([...m].filter(([, r]) => fn(r))), has: (id) => m.has(id) });
    const you = { roles: { get cache() { return cache(mine); }, add: async (r) => { mine.set(r.id, r); }, remove: async (list) => { for (const r of list) mine.delete(r.id); } } };
    await db.setCardGroups("bg", ["loona", "twice"]);
    const guild = { id: "bg", members: { me: { permissions: { has: () => true } }, fetch: async () => you },
        roles: { get cache() { return cache(roles); }, create: async (o) => { const r = { id: String(roles.size + 1), ...o }; roles.set(r.id, r); return r; } } };
    const replies = [];
    const run = (args) => bias.run({}, { guild, author: { id: A, username: "orbit" }, reply: async (p) => { replies.push(p); } }, args);
    await run(["heejin"]);
    assert.deepStrictEqual([...mine.values()].map((r) => [r.name, r.colors.primaryColor]), [["HeeJin bias", pc.findAnyMember("heejin").color.hex]]);
    await run(["twice", "nayeon"]);
    assert.deepStrictEqual([...mine.values()].map((r) => r.name), ["TWICE Nayeon bias"]);
    await run(["heejin"]); // reuses the role made before
    assert.strictEqual(roles.size, 2);
    await run(["aespa", "karina"]); // not one of this server's groups
    assert.match(replies.at(-1), /isn't one of this server's card groups/);
    await run(["none"]);
    assert.strictEqual(mine.size, 0);
    assert.match(replies.at(-1).content, /Took your bias role off/);
});
