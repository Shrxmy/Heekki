process.env.DB_PATH = ":memory:";
process.env.LASTFM_API_KEY = "test-key";
const test = require("node:test");
const assert = require("node:assert");

const http = require("../lib/info/http");
const lastfm = require("../lib/lastfm");
const db = require("../lib/db");
const cmd = (name) => require(`../commands/lastfm/${name}.js`);

const ME = "111111111111111111", FRIEND = "222222222222222222", STRANGER = "333333333333333333";
const person = (id, displayName) => ({ id, displayName, displayAvatarURL: () => "https://cdn.discordapp.com/a.png" });
function fakeMsg(authorId = ME) {
    const replies = [];
    const members = new Map([[ME, person(ME, "Orbit")], [FRIEND, person(FRIEND, "Yves*Fan")]]);
    const cache = { has: (id) => members.has(id), get: (id) => members.get(id) };
    const guild = { id: "g1", name: "VaLul", iconURL: () => null, members: { cache, fetch: async (id) => (id ? members.get(id) ?? null : members) } };
    return { replies, message: { guild, author: { id: authorId }, member: members.get(authorId), reply: async (p) => { replies.push(p); return {}; } } };
}
const text = (p) => (typeof p === "string" ? p : p.content ?? "");
const embedOf = (p) => p.embeds[0].toJSON();
/** The Last.fm method and params of a mocked getJson call. */
const params = (call) => Object.fromEntries(new URL(call.arguments[0]).searchParams);

test("without an API key the fm commands explain it and never call Last.fm", async (t) => {
    const get = t.mock.method(http, "getJson", async () => ({}));
    t.after(() => { process.env.LASTFM_API_KEY = "test-key"; });
    delete process.env.LASTFM_API_KEY;
    for (const name of ["fm", "fmset", "fmtop", "whoknows", "collage"]) {
        const a = fakeMsg();
        await cmd(name).run({}, a.message, ["orbit12"]);
        assert.match(text(a.replies[0]), /LASTFM_API_KEY/, name);
    }
    assert.strictEqual(get.mock.callCount(), 0);
});

test("fmset: checks the name, links with Last.fm's spelling, and says when the user doesn't exist", async (t) => {
    const get = t.mock.method(http, "getJson", async () => ({ user: { name: "Orbit12", playcount: "1234" } }));
    const a = fakeMsg();
    await cmd("fmset").run({}, a.message, ["../user"]);
    assert.strictEqual(get.mock.callCount(), 0);
    assert.match(text(a.replies[0]), /fmset orbit12/);

    const b = fakeMsg();
    await cmd("fmset").run({}, b.message, ["orbit12"]);
    assert.deepStrictEqual({ method: params(get.mock.calls[0]).method, user: params(get.mock.calls[0]).user }, { method: "user.getInfo", user: "orbit12" });
    assert.strictEqual(db.getLastfm(ME), "Orbit12");
    assert.match(text(b.replies[0]), /Orbit12.*1,234 scrobbles/);

    get.mock.mockImplementation(async () => { throw new Error("HTTP 404"); });
    const c = fakeMsg();
    await cmd("fmset").run({}, c.message, ["nobody99"]);
    assert.match(text(c.replies[0]), /couldn't find a Last.fm user called `nobody99`/);
    get.mock.mockImplementation(async () => ({ error: 6, message: "User not found" })); // error sent with HTTP 200
    const d = fakeMsg();
    await cmd("fmset").run({}, d.message, ["nobody99"]);
    assert.match(text(d.replies[0]), /couldn't find/);
    assert.strictEqual(db.getLastfm(ME), "Orbit12", "a failed link keeps the old one");
});

test("fm: asks unlinked people to link, shows the current song with plays for linked ones", async (t) => {
    db.removeLastfm(ME);
    const get = t.mock.method(http, "getJson", async (url) => (params({ arguments: [url] }).method === "user.getRecentTracks"
        ? { recenttracks: { "@attr": { total: "12034" }, track: [{ name: "Butterfly [Remix]", url: "https://www.last.fm/music/LOONA/_/Butterfly", "@attr": { nowplaying: "true" },
            artist: { "#text": "LOONA" }, album: { "#text": "[X X]" }, image: [{ "#text": "https://lastfm.freetls.fastly.net/i/u/300x300/abc.png" }] }] } }
        : { track: { userplaycount: "152" } }));
    const a = fakeMsg();
    await cmd("fm").run({}, a.message, []);
    assert.match(text(a.replies[0]), /fmset/);
    assert.strictEqual(get.mock.callCount(), 0);

    db.setLastfm(ME, "Orbit12");
    const b = fakeMsg();
    await cmd("fm").run({}, b.message, []);
    const e = embedOf(b.replies[0]);
    assert.match(e.author.name, /Orbit is listening to$/);
    assert.ok(e.description.includes("[Butterfly \\[Remix\\]](https://www.last.fm/music/LOONA/_/Butterfly)"), e.description);
    assert.ok(e.description.includes("*\\[X X\\]*"));
    assert.strictEqual(e.thumbnail.url, "https://lastfm.freetls.fastly.net/i/u/300x300/abc.png");
    assert.match(e.footer.text, /152 plays · 12,034 scrobbles in total/);
    assert.deepStrictEqual(params(get.mock.calls[1]), { method: "track.getInfo", artist: "LOONA", track: "Butterfly [Remix]", username: "Orbit12", autocorrect: "1", api_key: "test-key", format: "json" });

    const c = fakeMsg();
    await cmd("fm").run({}, c.message, [`<@${FRIEND}>`]);
    assert.match(text(c.replies[0]), /Yves\\\*Fan\*\* hasn't linked/);
});

test("fmtop: reads type and period from the args, lists the top 10", async (t) => {
    db.setLastfm(ME, "Orbit12");
    const get = t.mock.method(http, "getJson", async () => ({ topalbums: { album: [
        { name: "[12:00]", artist: { name: "LOONA" }, playcount: "40", url: "https://www.last.fm/music/LOONA/12:00" },
        { name: "Flip That", artist: { name: "LOONA" }, playcount: "1", url: "javascript:alert(1)" }] } }));
    const a = fakeMsg();
    await cmd("fmtop").run({}, a.message, ["albums", "month"]);
    const p = params(get.mock.calls[0]);
    assert.deepStrictEqual([p.method, p.period, p.user], ["user.getTopAlbums", "1month", "Orbit12"]);
    const e = embedOf(a.replies[0]);
    assert.match(e.author.name, /Orbit's top albums, this month/);
    assert.ok(e.description.includes("`1.` [\\[12:00\\]](https://www.last.fm/music/LOONA/12:00) by LOONA · 40 plays"));
    assert.ok(e.description.includes("`2.` Flip That by LOONA · 1 play"), "links only go to last.fm");
});

test("whoknows: ranks linked members of this server, skips everyone else", async (t) => {
    db.setLastfm(ME, "Orbit12");
    db.setLastfm(FRIEND, "YvesFan");
    db.setLastfm(STRANGER, "NotHere"); // linked, but not in this server
    const PLAYS = { Orbit12: "40", YvesFan: "900" };
    const get = t.mock.method(http, "getJson", async (url) => {
        const p = params({ arguments: [url] });
        return { artist: { name: "LOONA", url: "https://www.last.fm/music/LOONA", stats: { userplaycount: PLAYS[p.username] ?? "0" } } };
    });
    const a = fakeMsg();
    await cmd("whoknows").run({}, a.message, ["loona"]);
    const asked = get.mock.calls.map((c) => params(c).username).filter(Boolean).sort();
    assert.deepStrictEqual(asked, ["Orbit12", "YvesFan"]);
    const e = embedOf(a.replies[0]);
    assert.strictEqual(e.title, "Who knows LOONA?");
    assert.deepStrictEqual(e.description.split("\n"), ["👑 Yves\\*Fan · 900 plays", "`2.` **Orbit** · 40 plays"]);
    assert.match(e.footer.text, /2 listeners · 940 plays · 2 linked members checked/);
});

test("collage: draws a picture, only downloads covers from Last.fm's image server", async (t) => {
    db.setLastfm(ME, "Orbit12");
    t.mock.method(http, "getJson", async () => ({ topalbums: { album: [
        { name: "[+ +]", artist: { name: "LOONA" }, image: [{ "#text": "https://lastfm.freetls.fastly.net/i/u/300x300/a.png" }] },
        { name: "Elsewhere", artist: { name: "LOONA" }, image: [{ "#text": "https://evil.example/a.png" }] },
        { name: "Other CDN", artist: { name: "LOONA" }, image: [{ "#text": "https://lastfm-img.freetls.fastly.net/i/u/300x300/b.jpg" }] },
        { name: "No art", artist: { name: "LOONA" }, image: [{ "#text": "https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png" }] }] } }));
    const covers = t.mock.method(http, "getBuffer", async () => { throw new Error("offline"); });
    t.after(() => assert.ok(covers.mock.calls.every((c) => c.arguments[1].redirect === "error"), "cover downloads never follow redirects"));
    const a = fakeMsg();
    await cmd("collage").run({}, a.message, ["year"]);
    assert.deepStrictEqual(covers.mock.calls.map((c) => c.arguments[0]),
        ["https://lastfm.freetls.fastly.net/i/u/300x300/a.png", "https://lastfm-img.freetls.fastly.net/i/u/300x300/b.jpg"]);
    const reply = a.replies[0];
    assert.match(embedOf(reply).author.name, /top albums, this year/);
    assert.strictEqual(embedOf(reply).image.url, "attachment://collage.jpg");
    const jpeg = reply.files[0].attachment;
    assert.deepStrictEqual([...jpeg.subarray(0, 2)], [0xff, 0xd8], "a JPEG");
});

test("fmunset removes the link once", () => {
    db.setLastfm(ME, "Orbit12");
    const replies = [];
    const message = { author: { id: ME }, reply: async (p) => replies.push(p) };
    cmd("fmunset").run({}, message, []);
    cmd("fmunset").run({}, message, []);
    assert.match(replies[0], /Unlinked/);
    assert.match(replies[1], /haven't linked/);
    assert.strictEqual(db.getLastfm(ME), null);
});

test("review fixes: links stay on last.fm, odd args fall back to defaults", () => {
    assert.strictEqual(lastfm.link("x", "https://www.last.fm/) [external](https://example.org/)"),
        "[x](https://www.last.fm/%29%20%5Bexternal%5D%28https://example.org/%29)");
    assert.strictEqual(lastfm.link("Song (Remix)", "https://www.last.fm/music/A/_/Song+(Remix)"), "[Song (Remix)](https://www.last.fm/music/A/_/Song+%28Remix%29)");
    assert.strictEqual(lastfm.link("x", "https://www.last.fm.evil.example/"), "x");
    assert.strictEqual(lastfm.link("x", `https://www.last.fm/${"a".repeat(400)}`), "x", "huge URLs are not linked");
    assert.strictEqual(lastfm.periodFrom(["constructor"]), lastfm.PERIODS.week);
    assert.strictEqual(lastfm.periodFrom(["__proto__", "YEAR"]), lastfm.PERIODS.year);
});

test("review fix: whoknows treats failed lookups as unknown, not zero plays", async (t) => {
    db.setLastfm(ME, "Orbit12");
    db.setLastfm(FRIEND, "YvesFan");
    t.mock.method(http, "getJson", async (url) => {
        const p = params({ arguments: [url] });
        if (p.username === "YvesFan") throw new Error("HTTP 500");
        return { artist: { name: "LOONA", stats: { userplaycount: p.username ? "40" : "0" } } };
    });
    const a = fakeMsg();
    await cmd("whoknows").run({}, a.message, ["loona"]);
    assert.match(embedOf(a.replies[0]).footer.text, /\(1 couldn't be loaded\)/);

    http.getJson.mock.mockImplementation(async (url) => {
        if (params({ arguments: [url] }).username) throw new Error("HTTP 500");
        return { artist: { name: "LOONA" } };
    });
    const b = fakeMsg();
    await cmd("whoknows").run({}, b.message, ["loona"]);
    assert.match(text(b.replies[0]), /didn't answer/, "all failed: no fake 'nobody listens' result");
});

const server = () => require("../lib/lastfm/server");

test("crowns: only a confirmed higher play count takes a crown", () => {
    const { decideCrown } = server();
    const ranking = (counts, linked = counts.map((c) => c.id)) => ({ linked: new Set(linked), counts,
        listeners: counts.filter((c) => !c.failed && c.plays > 0).sort((a, b) => b.plays - a.plays) });
    const held = { user_id: "A", plays: 50 };
    assert.deepStrictEqual(decideCrown(null, ranking([{ id: "A", plays: 5 }])), { userId: "A", plays: 5 }, "first listener claims it");
    assert.strictEqual(decideCrown(null, ranking([{ id: "A", plays: 0 }])), null, "no plays, no crown");
    assert.deepStrictEqual(decideCrown(held, ranking([{ id: "A", plays: 60 }, { id: "B", plays: 61 }])), { userId: "B", plays: 61, takenFrom: "A" });
    assert.deepStrictEqual(decideCrown(held, ranking([{ id: "A", plays: 61 }, { id: "B", plays: 61 }])), { userId: "A", plays: 61 }, "a tie keeps it");
    assert.deepStrictEqual(decideCrown(held, ranking([{ id: "A", failed: true }, { id: "B", plays: 900 }])), { userId: "A", plays: 50 }, "failed lookup keeps it");
    assert.deepStrictEqual(decideCrown(held, ranking([{ id: "B", plays: 900 }], ["A", "B"])), { userId: "A", plays: 50 }, "holder not checked keeps it");
    assert.deepStrictEqual(decideCrown(held, ranking([{ id: "B", plays: 3 }])), { userId: "B", plays: 3, takenFrom: "A" }, "holder unlinked or left");
    assert.strictEqual(decideCrown(held, ranking([{ id: "A", plays: 0 }])), null, "holder dropped to 0 and nobody else listens");
});

test("whoknows hands the crown over and crowns lists it", async (t) => {
    db.setLastfm(ME, "Orbit12");
    db.setLastfm(FRIEND, "YvesFan");
    const plays = { Orbit12: "40", YvesFan: "10" };
    t.mock.method(http, "getJson", async (url) => {
        const p = params({ arguments: [url] });
        return { artist: { name: "ARTMS", url: "https://www.last.fm/music/ARTMS", stats: { userplaycount: plays[p.username] ?? "0" } } };
    });
    const a = fakeMsg();
    await cmd("whoknows").run({}, a.message, ["artms"]);
    assert.deepStrictEqual({ ...db.getCrown("g1", "artms") }, { artist: "ARTMS", user_id: ME, plays: 40 });
    assert.ok(embedOf(a.replies[0]).description.startsWith("👑 **Orbit** · 40 plays"));

    plays.YvesFan = "41";
    const b = fakeMsg();
    await cmd("whoknows").run({}, b.message, ["ARTMS"]);
    assert.match(embedOf(b.replies[0]).description, /👑 \*\*Yves\\\*Fan\*\* took the ARTMS crown from Orbit!/);

    const c = fakeMsg(FRIEND);
    await cmd("crowns").run({}, c.message, []);
    assert.match(embedOf(c.replies[0]).description, /\*\*ARTMS\*\* · 41 plays/);
    const d = fakeMsg();
    await cmd("crowns").run({}, d.message, []);
    assert.match(text(d.replies[0]), /don't have any crowns yet/);
});

test("wkt and wka: Artist - Title, or what you're playing", async (t) => {
    db.setLastfm(ME, "Orbit12");
    db.removeLastfm(FRIEND);
    const get = t.mock.method(http, "getJson", async (url) => {
        const p = params({ arguments: [url] });
        if (p.method === "user.getRecentTracks") return { recenttracks: { track: [{ name: "Butterfly", artist: { "#text": "LOONA" }, album: { "#text": "[X X]" } }] } };
        if (p.method === "track.getInfo") return { track: { name: "Butterfly", artist: { name: "LOONA" }, url: "https://www.last.fm/music/LOONA/_/Butterfly", userplaycount: "7" } };
        return { album: { name: "[X X]", artist: "LOONA", userplaycount: "3", image: [] } };
    });
    const a = fakeMsg();
    await cmd("wkt").run({}, a.message, ["LOONA", "-", "Butterfly"]);
    assert.strictEqual(embedOf(a.replies[0]).title, "Who knows Butterfly by LOONA?");
    const b = fakeMsg();
    await cmd("wkt").run({}, b.message, ["Butterfly"]);
    assert.match(text(b.replies[0]), /Artist - Track/);
    const c = fakeMsg();
    await cmd("wka").run({}, c.message, []);
    assert.strictEqual(embedOf(c.replies[0]).title, "Who knows [X X] by LOONA?");
    assert.ok(get.mock.calls.some((call) => params(call).method === "album.getInfo" && params(call).album === "[X X]"), "used the album you're playing");
});

test("collage sizes: 3x3 by default, up to 10x10, titles and plays are optional", async (t) => {
    const { sizeFrom, drawCollage } = require("../lib/lastfm/collage");
    assert.deepStrictEqual(sizeFrom([]), { cols: 3, rows: 3 });
    assert.deepStrictEqual(sizeFrom(["month", "4X6"]), { cols: 4, rows: 6 });
    assert.strictEqual(sizeFrom(["11x11"]), null);
    assert.strictEqual(sizeFrom(["0x3"]), null);
    const { loadImage } = require("@napi-rs/canvas");
    const big = await loadImage(await drawCollage(Array.from({ length: 100 }, (_, i) => ({ name: `A${i}`, artist: "X", plays: i })), { cols: 10, rows: 10, plays: true }));
    assert.deepStrictEqual([big.width, big.height], [1500, 1500]);

    db.setLastfm(ME, "Orbit12");
    const get = t.mock.method(http, "getJson", async () => ({ topalbums: { album: [{ name: "A", artist: { name: "B" }, playcount: "4", image: [] }] } }));
    const a = fakeMsg();
    await cmd("collage").run({}, a.message, ["5x5", "notitles", "plays"]);
    assert.strictEqual(params(get.mock.calls[0]).limit, "25");
    assert.match(embedOf(a.replies[0]).footer.text, /5x5/);
    const b = fakeMsg();
    await cmd("collage").run({}, b.message, ["12x12"]);
    assert.match(text(b.replies[0]), /up to 10x10/);
});

test("taste: shared artists, a moon match bar, and sensible refusals", async (t) => {
    const { compare, moons } = cmd("taste");
    const r = compare(new Map([["LOONA", 100], ["ARTMS", 20], ["IU", 5], ["Yves", 1]]), new Map([["ARTMS", 50], ["LOONA", 3]]));
    assert.deepStrictEqual(r.common.map((c) => c.name), ["ARTMS", "LOONA"], "sorted by the smaller play count");
    assert.strictEqual(r.score, 1);
    assert.strictEqual(moons(0.34), "🌕🌕🌕🌑🌑🌑🌑🌑🌑🌑");

    db.setLastfm(ME, "Orbit12");
    db.setLastfm(FRIEND, "YvesFan");
    t.mock.method(http, "getJson", async (url) => ({ topartists: { artist: params({ arguments: [url] }).user === "Orbit12"
        ? [{ name: "LOONA", playcount: "100" }, { name: "IU", playcount: "9" }] : [{ name: "LOONA", playcount: "30" }, { name: "TWICE", playcount: "8" }] } }));
    const a = fakeMsg();
    await cmd("taste").run({}, a.message, [FRIEND]);
    const e = embedOf(a.replies[0]);
    assert.strictEqual(e.title, "🌕🌕🌕🌕🌕🌑🌑🌑🌑🌑 50% match");
    assert.match(e.description, /\*\*LOONA\*\* · 100 plays vs 30 plays/);
    const b = fakeMsg();
    await cmd("taste").run({}, b.message, []);
    assert.match(text(b.replies[0]), /taste @someone/);
    const c = fakeMsg();
    await cmd("taste").run({}, c.message, [ME]);
    assert.match(text(c.replies[0]), /yourself/);
});

test("recent and artist: scrobble times, now playing, bio without the Last.fm link", async (t) => {
    db.setLastfm(ME, "Orbit12");
    db.removeLastfm(FRIEND);
    t.mock.method(http, "getJson", async (url) => {
        const p = params({ arguments: [url] });
        if (p.method === "user.getRecentTracks") return { recenttracks: { "@attr": { total: "5" }, track: [
            { name: "Now", artist: { "#text": "LOONA" }, "@attr": { nowplaying: "true" } },
            { name: "Before", artist: { "#text": "LOONA" }, date: { uts: "1700000000" } }] } };
        if (p.method === "artist.getTopAlbums") return { topalbums: { album: [{ image: [{ "#text": "https://lastfm.freetls.fastly.net/i/u/300x300/c.jpg" }] }] } };
        return { artist: { name: "LOONA", url: "https://www.last.fm/music/LOONA", stats: { listeners: "1000", playcount: "50000", userplaycount: p.username ? "12" : undefined },
            bio: { summary: 'Twelve girls. <a href="https://www.last.fm/music/LOONA">Read more on Last.fm</a>' }, tags: { tag: [{ name: "k-pop" }] } } };
    });
    const a = fakeMsg();
    await cmd("recent").run({}, a.message, []);
    const lines = embedOf(a.replies[0]).description.split("\n");
    assert.match(lines[0], /Now.*🎧 now/);
    assert.match(lines[1], /Before.*<t:1700000000:R>/);

    const b = fakeMsg();
    await cmd("artist").run({}, b.message, ["loona"]);
    const e = embedOf(b.replies[0]);
    assert.strictEqual(e.description, "Twelve girls.");
    assert.strictEqual(e.thumbnail.url, "https://lastfm.freetls.fastly.net/i/u/300x300/c.jpg");
    const field = (name) => e.fields.find((f) => f.name === name)?.value;
    assert.strictEqual(field("Your plays"), "12 plays");
    assert.strictEqual(field("Server rank"), "#1 of 1");
    assert.match(field("👑 Crown"), /Orbit · 12 plays/);
});
