process.env.DATABASE_URL = "memory";
const test = require("node:test");
const assert = require("node:assert");

test("getJson: sends a user agent and timeout, rejects bad statuses and oversized bodies", async (t) => {
    const http = require("../lib/info/http");
    const calls = [];
    t.mock.method(globalThis, "fetch", async (url, opts) => { calls.push(opts); return new Response('{"ok":1}', { headers: { "content-type": "application/json" } }); });
    assert.deepStrictEqual(await http.getJson("https://example.org/a"), { ok: 1 });
    assert.match(calls[0].headers["User-Agent"], /Heekki/);
    assert.ok(calls[0].signal instanceof AbortSignal);
    globalThis.fetch.mock.mockImplementation(async () => new Response("nope", { status: 500 }));
    await assert.rejects(http.getJson("https://example.org/a"), /HTTP 500/);
    globalThis.fetch.mock.mockImplementation(async () => new Response("x".repeat(http.MAX_BYTES + 1)));
    await assert.rejects(http.getText("https://example.org/a"), /too large/);
});

test("format helpers: durations, Discord timestamps, HTML/markup cleanup, truncation", () => {
    const f = require("../lib/info/format");
    assert.strictEqual(f.duration(90_061_000), "1d 1h 1m 1s");
    assert.strictEqual(f.duration(5_000), "5s");
    assert.strictEqual(f.stamp(new Date(1_700_000_000_000)), "<t:1700000000:D> (<t:1700000000:R>)");
    assert.strictEqual(f.stripHtml("Hi<br>there <i>you</i> &amp; me&#39;s"), "Hi\nthere you & me's");
    assert.strictEqual(f.truncate("abcdef", 4), "abc…");
    assert.strictEqual(f.truncate("abc", 4), "abc");
});

const http = () => require("../lib/info/http");
const info = (name) => require(`../commands/info/${name}.js`);
function fakeMsg({ nsfw = false } = {}) {
    const replies = [];
    const channel = { id: "c1", nsfw, name: "general", type: 0 };
    return { replies, message: {
        guild: { id: "g1", channels: { cache: new Map([["c1", channel]]) } }, channel: { id: "c1" },
        author: { id: "u1" }, member: { id: "u1" },
        reply: async (p) => { replies.push(p); return {}; },
    } };
}
const text = (p) => (typeof p === "string" ? p : p.content ?? "");
const embedOf = (p) => p.embeds[0].toJSON();

test("github: refuses odd usernames without calling the API, shows a profile otherwise", async (t) => {
    const get = t.mock.method(http(), "getJson", async () => ({ login: "octocat", name: "The Octocat", html_url: "https://github.com/octocat",
        avatar_url: "https://avatars.githubusercontent.com/u/1", bio: "hi", public_repos: 8, followers: 9, following: 1, created_at: "2011-01-25T18:44:36Z" }));
    const a = fakeMsg();
    await info("github").run({}, a.message, ["../../repos/x"]);
    assert.strictEqual(get.mock.callCount(), 0);
    assert.match(text(a.replies[0]), /valid GitHub username/);
    const b = fakeMsg();
    await info("github").run({}, b.message, ["octocat"]);
    assert.strictEqual(get.mock.calls[0].arguments[0], "https://api.github.com/users/octocat");
    assert.strictEqual(embedOf(b.replies[0]).title, "The Octocat (octocat)");
});

test("pokedex: normalizes names, shows types and stats, says when not found", async (t) => {
    t.mock.method(http(), "getJson", async (url) => {
        if (url.includes("pokemon-species")) return { flavor_text_entries: [{ language: { name: "en" }, flavor_text: "Its genetic\fcode is irregular." }] };
        if (url.endsWith("/mr-mime")) return { id: 122, name: "mr-mime", height: 13, weight: 545, types: [{ type: { name: "psychic" } }, { type: { name: "fairy" } }],
            stats: [{ base_stat: 40, stat: { name: "hp" } }], abilities: [{ ability: { name: "filter" } }], species: { url: "https://pokeapi.co/api/v2/pokemon-species/122/" },
            sprites: { other: { "official-artwork": { front_default: "https://raw.githubusercontent.com/x/122.png" } } } };
        throw new Error("HTTP 404");
    });
    const a = fakeMsg();
    await info("pokedex").run({}, a.message, ["Mr.", "Mime"]);
    const e = embedOf(a.replies[0]);
    assert.strictEqual(e.title, "#122 Mr Mime");
    assert.ok(e.fields.some((f) => f.name === "Type" && f.value === "Psychic / Fairy"));
    assert.ok(e.description.includes("Its genetic code is irregular."));
    const b = fakeMsg();
    await info("pokedex").run({}, b.message, ["missingno"]);
    assert.match(text(b.replies[0]), /couldn't find/);
});

test("wikipedia: summary with link, and a hint for ambiguous titles", async (t) => {
    t.mock.method(http(), "getJson", async (url) => {
        if (url.includes("opensearch")) return ["orbit", ["Orbit"], [""], ["https://en.wikipedia.org/wiki/Orbit"]];
        return { type: "standard", title: "Orbit", extract: "In celestial mechanics, an orbit...", content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Orbit" } }, thumbnail: { source: "https://upload.wikimedia.org/x.png" } };
    });
    const a = fakeMsg();
    await info("wikipedia").run({}, a.message, ["orbit"]);
    assert.strictEqual(embedOf(a.replies[0]).url, "https://en.wikipedia.org/wiki/Orbit");
    http().getJson.mock.mockImplementation(async (url) => (url.includes("opensearch") ? ["x", ["Mercury"], [""], [""]] : { type: "disambiguation", title: "Mercury" }));
    const b = fakeMsg();
    await info("wikipedia").run({}, b.message, ["mercury"]);
    assert.match(text(b.replies[0]), /more specific/);
});

test("weather: finds the place, describes the sky, and handles unknown places", async (t) => {
    t.mock.method(http(), "getJson", async (url) => (url.includes("geocoding")
        ? { results: [{ name: "Seoul", country: "South Korea", latitude: 37.5, longitude: 127, timezone: "Asia/Seoul" }] }
        : { current: { temperature_2m: 2.8, apparent_temperature: -0.7, relative_humidity_2m: 43, weather_code: 1, wind_speed_10m: 2.6, time: "2026-11-08T04:00" } }));
    const a = fakeMsg();
    await info("weather").run({}, a.message, ["Seoul"]);
    const e = embedOf(a.replies[0]);
    assert.match(e.title, /Seoul, South Korea/);
    assert.match(e.description, /Mainly clear/);
    assert.ok(e.fields.some((f) => f.value.includes("2.8°C") && f.value.includes("37°F")));
    http().getJson.mock.mockImplementation(async () => ({}));
    const b = fakeMsg();
    await info("weather").run({}, b.message, ["Nowhereville"]);
    assert.match(text(b.replies[0]), /couldn't find a place/);
});

test("urbandictionary only works in NSFW channels and cleans up [links]", async (t) => {
    const get = t.mock.method(http(), "getJson", async () => ({ list: [{ word: "orbit", definition: "A [LOONA] fan.", example: "I'm an [orbit].", thumbs_up: 5, thumbs_down: 1, permalink: "https://www.urbandictionary.com/x" }] }));
    const a = fakeMsg({ nsfw: false });
    await info("urbandictionary").run({}, a.message, ["orbit"]);
    assert.match(text(a.replies[0]), /age-restricted/);
    assert.strictEqual(get.mock.callCount(), 0);
    const b = fakeMsg({ nsfw: true });
    await info("urbandictionary").run({}, b.message, ["orbit"]);
    assert.strictEqual(embedOf(b.replies[0]).description, "A LOONA fan.");
});

test("anime: AniList result with the HTML removed from the description", async (t) => {
    t.mock.method(http(), "getJson", async () => ({ data: { Media: { title: { romaji: "Sousou no Frieren", english: "Frieren" }, averageScore: 91, episodes: 28,
        status: "FINISHED", siteUrl: "https://anilist.co/anime/154587", coverImage: { large: "https://s4.anilist.co/x.jpg" }, description: "An elf<br><i>mage</i>.", genres: ["Fantasy"], seasonYear: 2023 } } }));
    const a = fakeMsg();
    await info("anime").run({}, a.message, ["frieren"]);
    const e = embedOf(a.replies[0]);
    assert.strictEqual(e.title, "Frieren");
    assert.strictEqual(e.description, "An elf\nmage.");
    assert.ok(e.fields.some((f) => f.name === "Score" && f.value === "91/100"));
});

test("news: parses the feed, decodes entities, shows at most 5 stories", async (t) => {
    const item = (n) => `<item><title>Story ${n} &amp; more - Source</title><link>https://news.google.com/x${n}</link><pubDate>Wed, 11 Aug 2021 07:00:00 GMT</pubDate></item>`;
    t.mock.method(http(), "getText", async () => `<rss><channel>${[1, 2, 3, 4, 5, 6, 7].map(item).join("")}</channel></rss>`);
    const a = fakeMsg();
    await info("news").run({}, a.message, []);
    const e = embedOf(a.replies[0]);
    assert.strictEqual((e.description.match(/\[Story/g) ?? []).length, 5);
    assert.ok(e.description.includes("Story 1 & more"));
    assert.match(e.title, /LOONA/); // default topic
});

test("steam: shows price (with discount) or Free, and handles no results", async (t) => {
    t.mock.method(http(), "getJson", async (url) => (url.includes("storesearch")
        ? { items: [{ id: 413150, name: "Stardew Valley" }] }
        : { 413150: { success: true, data: { name: "Stardew Valley", short_description: "Farm.", header_image: "https://shared.akamai.steamstatic.com/h.jpg",
            is_free: false, price_overview: { final_formatted: "$7.49", initial_formatted: "$14.99", discount_percent: 50 }, genres: [{ description: "Indie" }], release_date: { date: "Feb 26, 2016" } } } }));
    const a = fakeMsg();
    await info("steam").run({}, a.message, ["stardew"]);
    assert.ok(embedOf(a.replies[0]).fields.some((f) => f.name === "Price" && f.value === "~~$14.99~~ **$7.49** (-50%)"));
    http().getJson.mock.mockImplementation(async () => ({ items: [] }));
    const b = fakeMsg();
    await info("steam").run({}, b.message, ["zzzzzz"]);
    assert.match(text(b.replies[0]), /couldn't find/);
});

const { Collection } = require("discord.js");
function fakeGuild({ canManage = true } = {}) {
    const everyone = { id: "g2", name: "@everyone", position: 0 };
    const mod = { id: "333333333333333333", name: "Orbit Mods", hexColor: "#f4028e", position: 2, mentionable: false, hoist: true, managed: false,
        createdAt: new Date(1_600_000_000_000), permissions: { toArray: () => ["KickMembers", "ManageMessages"] }, members: new Collection() };
    const roles = new Collection([[everyone.id, everyone], [mod.id, mod]]);
    const user = (id, name) => ({ id, username: name, globalName: name, tag: name, bot: false, createdAt: new Date(1_500_000_000_000), displayAvatarURL: () => "https://cdn.discordapp.com/a.png" });
    const member = (id, name, rs) => ({ id, displayName: name, user: user(id, name), joinedAt: new Date(1_650_000_000_000), displayHexColor: "#f4028e",
        premiumSince: null, roles: { cache: new Collection(rs.map((r) => [r.id, r])) } });
    const heejin = member("111111111111111111", "HeeJin", [everyone, mod]);
    const yves = member("222222222222222222", "Yves", [everyone]);
    mod.members.set(heejin.id, heejin);
    const text = { id: "444444444444444444", name: "general", type: 0, topic: "hi", nsfw: false, rateLimitPerUser: 0, parent: { name: "Chat" }, createdAt: new Date(1_600_000_000_000) };
    const voice = { id: "555555555555555555", name: "Music", type: 2, bitrate: 64000, userLimit: 0, parent: null, createdAt: new Date(1_600_000_000_000) };
    return {
        id: "g1", name: "Orbit Café", ownerId: "111111111111111111", memberCount: 2, createdAt: new Date(1_550_000_000_000),
        premiumTier: 1, premiumSubscriptionCount: 3, iconURL: () => "https://cdn.discordapp.com/i.png", bannerURL: () => null,
        roles: { cache: roles, everyone },
        channels: { cache: new Collection([[text.id, text], [voice.id, voice]]) },
        emojis: { cache: new Collection([["e1", {}]]) },
        members: { me: { permissions: { has: () => canManage } }, fetch: async (id) => (id ? ({ [heejin.id]: heejin, [yves.id]: yves }[id] ?? Promise.reject(new Error("Unknown"))) : null), cache: new Collection([[heejin.id, heejin], [yves.id, yves]]) },
        invites: { fetch: async () => new Collection([["a", { inviter: heejin.user, uses: 5 }], ["b", { inviter: yves.user, uses: 2 }], ["c", { inviter: heejin.user, uses: 1 }]]) },
        _: { heejin, yves, mod, text },
    };
}
function guildMsg(guild, who = guild._.yves) {
    const replies = [];
    return { replies, message: { guild, member: who, author: who.user, channel: { id: guild._.text.id }, reply: async (p) => { replies.push(p); return {}; } } };
}
const client = (extra = {}) => ({ uptime: 90_061_000, ws: { ping: 42 }, guilds: { cache: new Collection([["g1", { memberCount: 2 }]]) },
    commands: new Collection([["a", {}], ["b", {}]]), lavalink: { players: new Map([["g1", {}]]) },
    users: { fetch: async (id) => ({ id, username: "chuu", globalName: "Chuu", bot: false, createdAt: new Date(1_500_000_000_000),
        displayAvatarURL: () => "https://cdn.discordapp.com/a.png", bannerURL: () => (id === "111111111111111111" ? "https://cdn.discordapp.com/b.png" : null) }) }, ...extra });

test("whois shows yourself by default, lists roles without @everyone, and never pings", async () => {
    const g = fakeGuild();
    const a = guildMsg(g, g._.heejin);
    await info("whois").run(client(), a.message, []);
    const e = embedOf(a.replies[0]);
    assert.strictEqual(e.title, "HeeJin");
    const roles = e.fields.find((f) => f.name.startsWith("Roles"));
    assert.ok(roles.value.includes("<@&333333333333333333>") && !roles.value.includes("@everyone"));
    const b = guildMsg(g);
    await info("whois").run(client(), b.message, ["<@999999999999999999>"]);
    assert.strictEqual(text(b.replies[0]), "I couldn't find that member.");
});

test("roleinfo and rolememberinfo find roles by mention or name", async () => {
    const g = fakeGuild();
    const a = guildMsg(g);
    await info("roleinfo").run(client(), a.message, ["orbit", "mods"]);
    const e = embedOf(a.replies[0]);
    assert.strictEqual(e.title, "Orbit Mods");
    assert.ok(e.fields.some((f) => f.name === "Members" && f.value === "1"));
    const b = guildMsg(g);
    await info("rolememberinfo").run(client(), b.message, ["<@&333333333333333333>"]);
    assert.ok(embedOf(b.replies[0]).description.includes("HeeJin"));
    const c = guildMsg(g);
    await info("roleinfo").run(client(), c.message, ["nope"]);
    assert.match(text(c.replies[0]), /couldn't find that role/);
});

test("invites adds up uses per inviter, and explains a missing permission", async () => {
    const a = guildMsg(fakeGuild());
    await info("invites").run(client(), a.message, []);
    const lines = embedOf(a.replies[0]).description.split("\n");
    assert.match(lines[0], /HeeJin.*6/);
    assert.match(lines[1], /Yves.*2/);
    const b = guildMsg(fakeGuild({ canManage: false }));
    await info("invites").run(client(), b.message, []);
    assert.match(text(b.replies[0]), /Manage Server/);
});

test("serverinfo and channelinfo describe the server and the current channel", async () => {
    const g = fakeGuild();
    const a = guildMsg(g);
    await info("serverinfo").run(client(), a.message, []);
    const s = embedOf(a.replies[0]);
    assert.strictEqual(s.title, "Orbit Café");
    assert.ok(s.fields.some((f) => f.name === "Channels" && /1 text.*1 voice/.test(f.value)));
    const b = guildMsg(g);
    await info("channelinfo").run(client(), b.message, []);
    assert.strictEqual(embedOf(b.replies[0]).title, "#general");
    const c = guildMsg(g);
    await info("channelinfo").run(client(), c.message, ["<#555555555555555555>"]);
    assert.ok(embedOf(c.replies[0]).fields.some((f) => f.name === "Bitrate" && f.value === "64 kbps"));
});

test("userbanner, globalwhois, stats and uptime", async () => {
    const g = fakeGuild();
    const a = guildMsg(g, g._.heejin);
    await info("userbanner").run(client(), a.message, []);
    assert.strictEqual(embedOf(a.replies[0]).image.url, "https://cdn.discordapp.com/b.png");
    const b = guildMsg(g);
    await info("userbanner").run(client(), b.message, []);
    assert.match(text(b.replies[0]), /doesn't have a banner/);
    const c = guildMsg(g);
    await info("globalwhois").run(client(), c.message, ["123456789012345678"]);
    assert.strictEqual(embedOf(c.replies[0]).title, "Chuu (chuu)");
    const d = guildMsg(g);
    await info("globalwhois").run(client(), d.message, ["hello"]);
    assert.match(text(d.replies[0]), /user ID or mention/);
    const e = guildMsg(g);
    await info("stats").run(client(), e.message, []);
    assert.ok(embedOf(e.replies[0]).fields.some((f) => f.name === "Servers" && f.value === "1"));
    const f = guildMsg(g);
    await info("uptime").run(client(), f.message, []);
    assert.match(text(f.replies[0]), /1d 1h 1m 1s/);
});

test("review fix: news keeps the whole description under Discord's 4096 limit, even with huge links", async (t) => {
    const long = "https://news.google.com/rss/articles/" + "x".repeat(1500);
    const item = (n) => `<item><title>Story ${n}</title><link>${long}${n}</link><pubDate>Wed, 11 Aug 2021 07:00:00 GMT</pubDate></item>`;
    t.mock.method(http(), "getText", async () => `<rss>${[1, 2, 3, 4, 5].map(item).join("")}</rss>`);
    const a = fakeMsg();
    await info("news").run({}, a.message, ["x"]);
    assert.ok(embedOf(a.replies[0]).description.length <= 4096);
});

test("review fix: github caps the title even for very long profile names", async (t) => {
    t.mock.method(http(), "getJson", async () => ({ login: "octocat", name: "N".repeat(400), html_url: "https://github.com/octocat",
        avatar_url: "https://avatars.githubusercontent.com/u/1", public_repos: 1, followers: 1, following: 1, created_at: "2011-01-25T18:44:36Z" }));
    const a = fakeMsg();
    await info("github").run({}, a.message, ["octocat"]);
    assert.ok(embedOf(a.replies[0]).title.length <= 256);
});

test("review fix: pokedex only follows species links that point at PokeAPI", async (t) => {
    const urls = [];
    t.mock.method(http(), "getJson", async (url) => { urls.push(url);
        return { id: 1, name: "bulbasaur", height: 7, weight: 69, types: [{ type: { name: "grass" } }], stats: [], abilities: [],
            species: { url: "http://127.0.0.1:2333/v4/info" }, sprites: {} }; });
    const a = fakeMsg();
    await info("pokedex").run({}, a.message, ["bulbasaur"]);
    assert.deepStrictEqual(urls, ["https://pokeapi.co/api/v2/pokemon/bulbasaur"]);
    assert.strictEqual(embedOf(a.replies[0]).title, "#1 Bulbasaur");
});

test("review fix: the full member list is downloaded once per server, and retried after a failure", async () => {
    const { ensureMembers } = require("../lib/info/resolve");
    let calls = 0, fail = true;
    const guild = { id: "big", members: { fetch: async () => { calls++; if (fail) throw new Error("rate limited"); } } };
    assert.strictEqual(await ensureMembers(guild), false);
    fail = false;
    assert.strictEqual(await ensureMembers(guild), true);
    assert.strictEqual(await ensureMembers(guild), true);
    assert.strictEqual(calls, 2);
});
