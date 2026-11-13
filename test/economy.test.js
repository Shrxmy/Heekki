process.env.DATABASE_URL = "memory";
const test = require("node:test");
const assert = require("node:assert");

const pc = () => require("../lib/loona/photocards");
const db = () => require("../lib/db");
const replyMsg = (guildId, userId, extra = {}) => {
    const replies = [];
    return { replies, message: { guild: { id: guildId }, author: { id: userId }, member: { permissions: { has: () => true } }, reply: async (p) => { replies.push(p); return p; }, ...extra } };
};
const text = (p) => (typeof p === "string" ? p : p.content ?? p.embeds?.[0]?.toJSON().description ?? "");

test("sell: only extras are sold, coins and cards change together, and a pull's card is worth less than a pull", async () => {
    const { SELL_PRICES, RARITIES, PRICE } = pc();
    const average = RARITIES.reduce((s, r) => s + (r.weight / 100) * SELL_PRICES[r.key], 0);
    assert.ok(average < PRICE, `a pulled card sells for ${average} on average`);

    const sell = require("../commands/loona/sell");
    assert.strictEqual(sell.cardFrom(["kim", "lip", "RARE"]).id, "kimlip-rare");
    assert.strictEqual(sell.cardFrom(["chuu-moon"]).id, "chuu-moon");
    assert.strictEqual(sell.cardFrom(["nobody", "rare"]), null);

    for (let i = 0; i < 3; i++) await db().giftPhotocard("sg", "su", "kimlip-rare");
    await db().giftPhotocard("sg", "su", "yves-moon");
    const { message, replies } = replyMsg("sg", "su");
    await sell.run({}, message, ["yves", "moon"]);
    assert.match(text(replies.at(-1)), /don't have a spare/);
    await sell.run({}, message, ["dupes"]);
    assert.match(text(replies.at(-1)), /Kim Lip · Rare ×2 → \*\*150\*\*/);
    assert.match(text(replies.at(-1)), /\*\*\+150\*\* moon coins · Balance \*\*650\*\*/);
    assert.deepStrictEqual([...await db().photocardsOf("sg", "su")].sort(), [["kimlip-rare", 1], ["yves-moon", 1]]);
    await sell.run({}, message, ["dupes"]);
    assert.match(text(replies.at(-1)), /don't have any duplicates/);
});

test("daily: the streak grows on consecutive days up to 7, resets after a missed day, and pays once a day", async () => {
    const daily = require("../commands/fun/daily");
    const claim = (day, yesterday) => db().claimDaily("dg", "du", day, yesterday, daily.BASE, daily.PER_DAY, daily.MAX_STREAK);
    const coins = [];
    for (let d = 1; d <= 9; d++) {
        const day = `2026-11-${String(d).padStart(2, "0")}`, yesterday = `2026-11-${String(d - 1).padStart(2, "0")}`;
        coins.push((await claim(day, yesterday)).coins);
        assert.strictEqual(await claim(day, yesterday), null); // again the same day: nothing
    }
    assert.deepStrictEqual(coins, [150, 170, 190, 210, 230, 250, 270, 270, 270]);
    assert.strictEqual((await claim("2026-11-11", "2026-11-10")).streak, 1); // skipped the 10th
    assert.strictEqual(await claim("2026-11-10", "2026-11-09"), null); // a late request for an earlier day
    const { today, yesterday } = daily.days(new Date("2026-03-01T03:00:00Z"));
    assert.deepStrictEqual([today, yesterday], ["2026-03-01", "2026-02-28"]);
});

test("practice: pays 20-60 coins, then waits an hour", async () => {
    const practice = require("../commands/fun/practice");
    const { message, replies } = replyMsg("pg", "pu");
    await practice.run({}, message, []);
    const got = Number(text(replies[0]).match(/\*\*\+(\d+)\*\*/)[1]);
    assert.ok(got >= 20 && got <= 60);
    assert.strictEqual(await db().getCoins("pg", "pu"), 500 + got);
    await practice.run({}, message, []);
    assert.match(text(replies[1]), /Practise again in \*\*60 min\*\*/);
    assert.strictEqual(await db().getCoins("pg", "pu"), 500 + got);
});

test("drops: a card falls after enough chat in the drop channel, the first catch wins it, and spam can't drop two in 10 minutes", async (t) => {
    const drops = require("../lib/loona/drops");
    t.mock.method(pc(), "renderPhotocard", async () => Buffer.from("png"));
    await db().setDropChannel("xg", "drop-chan");
    const sent = [];
    let catcher = "xa";
    const channel = { id: "drop-chan", send: async (p) => sent.push(p),
        awaitMessages: async ({ filter }) => {
            const tries = [{ author: { id: "xb", bot: false }, content: "hello" }, { author: { id: catcher, bot: false }, content: " Catch " }];
            return { first: () => tries.find(filter) };
        } };
    const say = (channelId = "drop-chan") => drops.onMessage({ author: { bot: false }, guild: { id: "xg" }, channel: channelId === "drop-chan" ? channel : { id: channelId } });

    for (let i = 0; i < drops.MAX_MESSAGES * 2; i++) await say("other-chan"); // other channels don't count
    assert.strictEqual(sent.length, 0);
    for (let i = 0; i < drops.MAX_MESSAGES; i++) await say();
    assert.strictEqual(sent.length, 2); // the card, then who caught it
    assert.match(sent[1].content, /<@xa> caught/);
    assert.strictEqual([...(await db().photocardsOf("xg", "xa")).values()].reduce((a, b) => a + b, 0), 1);
    for (let i = 0; i < drops.MAX_MESSAGES * 3; i++) await say(); // lots more chat, but within 10 minutes
    assert.strictEqual(sent.length, 2);

    t.mock.timers.enable({ apis: ["Date"], now: Date.now() + drops.GAP_MS + 1 });
    catcher = "nobody";
    channel.awaitMessages = async () => ({ first: () => undefined });
    for (let i = 0; i < drops.MAX_MESSAGES; i++) await say();
    assert.match(sent.at(-1), /floated away/);
});

test("set-drop-channel: needs Manage Server, a text channel, and can turn drops off", async () => {
    const cmd = require("../commands/loona/set-drop-channel");
    const { ChannelType } = require("discord.js");
    const chan = { id: "12345678901234567", type: ChannelType.GuildText, permissionsFor: () => ({ has: () => true }) };
    const guild = { id: "cg", members: { me: {} }, channels: { cache: new Map([[chan.id, chan]]) } };
    const { message, replies } = replyMsg("cg", "cu", { guild });
    await cmd.run({}, { ...message, member: { permissions: { has: () => false } } }, [`<#${chan.id}>`]);
    assert.match(text(replies.at(-1)), /Manage Server/);
    await cmd.run({}, message, [`<#${chan.id}>`]);
    assert.strictEqual(await db().getDropChannel("cg"), chan.id);
    await cmd.run({}, message, ["off"]);
    assert.strictEqual(await db().getDropChannel("cg"), null);
});

test("drops: a second drop while one is running is refused, so one catch can't win two cards", async (t) => {
    const drops = require("../lib/loona/drops");
    t.mock.method(pc(), "renderPhotocard", async () => Buffer.from("png"));
    let release;
    const channel = { send: async () => {}, awaitMessages: () => new Promise((r) => { release = r; }) };
    const first = drops.drop(channel, "dd");
    await new Promise((r) => setImmediate(r));
    assert.strictEqual(await drops.drop(channel, "dd"), null);
    release({ first: () => ({ author: { id: "w1", bot: false }, content: "catch" }) });
    assert.strictEqual(await first, "w1");
    assert.strictEqual([...(await db().photocardsOf("dd", "w1")).values()].reduce((a, b) => a + b, 0), 1);
});

test("collection lists duplicates with what they'd sell for; showcase shows only cards you own", async (t) => {
    const { collectionEmbed } = require("../commands/loona/collection");
    const owned = new Map([["kimlip-rare", 3], ["chuu-moon", 2], ["yves-common", 1]]);
    const desc = collectionEmbed({ id: "1", displayName: "Orbit" }, owned).toJSON().description;
    assert.match(desc, /\*\*Duplicates\*\* · worth 900 with `sell dupes`/); // 2 × 75 + 1 × 750
    assert.match(desc, /Kim Lip · Rare ×3 \(2 spare, 150 coins\)/);
    assert.match(desc, /Chuu · Moon ×2 \(1 spare, 750 coins\)/);
    assert.doesNotMatch(desc, /Yves · Common ×/);
    assert.doesNotMatch(collectionEmbed({ id: "1", displayName: "Orbit" }, new Map([["yves-common", 1]])).toJSON().description, /Duplicates/);

    t.mock.method(pc(), "renderPhotocard", async () => Buffer.from("png"));
    const showcase = require("../commands/loona/showcase");
    await db().giftPhotocard("shg", "shu", "kimlip-moon");
    await db().giftPhotocard("shg", "shu", "kimlip-moon");
    const { message, replies } = replyMsg("shg", "shu", { member: { displayName: "Orbit" } });
    message.author.displayAvatarURL = () => "";
    await showcase.run({}, message, ["kim", "lip", "moon"]);
    assert.strictEqual(replies.at(-1).embeds[0].toJSON().title, "Kim Lip · Moon");
    assert.match(replies.at(-1).embeds[0].toJSON().description, /2 of this card/);
    assert.strictEqual(replies.at(-1).files[0].name, "photocard.png");
    await showcase.run({}, message, ["chuu", "moon"]);
    assert.match(text(replies.at(-1)), /don't have \*\*Chuu · Moon\*\* yet/);
    await showcase.run({}, message, ["nobody"]);
    assert.match(text(replies.at(-1)), /don't know that card/);
});
