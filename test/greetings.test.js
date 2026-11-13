process.env.DATABASE_URL = "memory";
const test = require("node:test");
const assert = require("node:assert");

const vars = { mention: "<@1>", username: "Heekki", server: "Orbit", count: 1234 };

test("fillPlaceholders replaces every placeholder and caps the length", async () => {
    const { fillPlaceholders } = require("../lib/greetings/format");
    assert.strictEqual(fillPlaceholders("Hi {user} {user}, {username} joined {server} (#{count})", vars),
        "Hi <@1> <@1>, Heekki joined Orbit (#1234)");
    assert.ok(fillPlaceholders("x".repeat(3000), vars).length <= 1900);
});

test("cardLine is plain text: name instead of mention, no Discord markup or emoji", async () => {
    const { cardLine } = require("../lib/greetings/format");
    assert.strictEqual(cardLine("Welcome {user} <@&5> <#6> <:orbit:123> 🌙!", { ...vars, username: "희진" }), "Welcome 희진 !");
});

test("parseColors accepts 12 hex colours and rejects anything else", async () => {
    const { parseColors } = require("../lib/greetings/format");
    const twelve = "ff0092 #FFD700,#0a5 " + Array(9).fill("#123456").join(" ");
    const parsed = parseColors(twelve);
    assert.strictEqual(parsed.length, 12);
    assert.strictEqual(parsed[0], "#FF0092");
    assert.strictEqual(parsed[2], "#00AA55");
    assert.strictEqual(parseColors(Array(11).fill("#123456").join(" ")), null);
    assert.strictEqual(parseColors(Array(11).fill("#123456").join(" ") + " #GGGGGG"), null);
});

test("greeting settings default, save, and reset per guild", async () => {
    const { getGreetSettings, updateGreetSettings, getGreetBackground } = require("../lib/db");
    const { DEFAULT_JOIN_MESSAGE, DEFAULT_LEAVE_MESSAGE, DEFAULT_COLORS } = require("../lib/greetings/format");
    const defaults = { channelId: null, joinEnabled: true, leaveEnabled: false, joinMessage: DEFAULT_JOIN_MESSAGE,
        leaveMessage: DEFAULT_LEAVE_MESSAGE, colors: DEFAULT_COLORS, hasBackground: false, birthdayEnabled: true };
    assert.deepStrictEqual(await getGreetSettings("g"), defaults);
    assert.strictEqual(DEFAULT_JOIN_MESSAGE, "Welcome to the Orbit, {user}! 🌙");
    assert.strictEqual(DEFAULT_LEAVE_MESSAGE, "{username} left the Orbit. 🌙");
    assert.strictEqual(DEFAULT_COLORS.length, 12);

    await updateGreetSettings("g", { channelId: "c", joinEnabled: false, joinMessage: "Hey {user}", background: Buffer.from([1, 2]) });
    const saved = await getGreetSettings("g");
    assert.strictEqual(saved.channelId, "c");
    assert.strictEqual(saved.joinEnabled, false);
    assert.strictEqual(saved.joinMessage, "Hey {user}");
    assert.strictEqual(saved.hasBackground, true);
    assert.ok(Buffer.from([1, 2]).equals(await getGreetBackground("g"))); // the image itself is in object storage
    assert.strictEqual(saved.leaveMessage, DEFAULT_LEAVE_MESSAGE); // untouched keys keep their value

    await updateGreetSettings("g", { joinMessage: null, background: null });
    assert.strictEqual((await getGreetSettings("g")).joinMessage, DEFAULT_JOIN_MESSAGE);
    assert.strictEqual((await getGreetSettings("g")).hasBackground, false);
    assert.strictEqual((await getGreetSettings("g")).channelId, "c");
    assert.deepStrictEqual(await getGreetSettings("other"), defaults);
});

test("renderCard draws a 1024x400 PNG, including Korean names and very long text", async () => {
    const { renderCard } = require("../lib/greetings/card");
    const { DEFAULT_COLORS } = require("../lib/greetings/format");
    const { loadImage, GlobalFonts } = require("@napi-rs/canvas");
    assert.ok(GlobalFonts.has("Noto Sans KR"));

    const png = await renderCard({ avatarURL: null, displayName: "희진 HeeJin", count: 1234,
        line: "Welcome to the Orbit, 희진!", colors: DEFAULT_COLORS, background: null });
    assert.ok(png.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])));
    const image = await loadImage(png);
    assert.strictEqual(image.width, 1024);
    assert.strictEqual(image.height, 400);

    const long = await renderCard({ avatarURL: null, displayName: "N".repeat(150), count: 5,
        line: "L".repeat(400), colors: DEFAULT_COLORS, background: null });
    assert.ok(long.length > 0);
});

test("isAllowedImageUrl only accepts https Discord CDN links", async () => {
    const { isAllowedImageUrl } = require("../lib/greetings/background");
    assert.ok(isAllowedImageUrl("https://cdn.discordapp.com/attachments/1/2/a.png?ex=1"));
    assert.ok(isAllowedImageUrl("https://media.discordapp.net/attachments/1/2/a.webp"));
    for (const bad of ["http://cdn.discordapp.com/a.png", "https://cdn.discordapp.com.evil.com/a.png",
        "https://evil.com/?u=https://cdn.discordapp.com/a.png", "https://user:pw@cdn.discordapp.com/a.png", "not a url"])
        assert.ok(!isAllowedImageUrl(bad), bad);
});

test("downloadBackground validates type, size and host, refuses redirects, and normalizes to 1024x400", async () => {
    const { downloadBackground } = require("../lib/greetings/background");
    const { createCanvas, loadImage } = require("@napi-rs/canvas");
    const url = "https://cdn.discordapp.com/attachments/1/2/a.png";
    const calls = [];
    const fake = (body, type) => async (u, opts) => { calls.push(opts); return new Response(body, { headers: { "content-type": type } }); };

    let called = false;
    await assert.rejects(downloadBackground("https://evil.com/a.png", async () => { called = true; }), /Only Discord image/);
    assert.strictEqual(called, false);
    await assert.rejects(downloadBackground(url, fake("<html>", "text/html")), /PNG, JPEG or WebP/);
    // no content-length header: the size cap must count the bytes as they stream in
    const tooBig = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(8 * 1024 * 1024)); c.enqueue(new Uint8Array(1)); c.close(); } });
    await assert.rejects(downloadBackground(url, fake(tooBig, "image/png")), /over 8 MB/);
    await assert.rejects(downloadBackground(url, async () => { throw new TypeError("redirect"); }), /couldn't download/);
    await assert.rejects(downloadBackground(url, async () => new Response("x", { status: 404, headers: { "content-type": "image/png" } })), /couldn't download/);

    const small = await createCanvas(50, 50).encode("png");
    const out = await downloadBackground(url, fake(small, "image/png"));
    const image = await loadImage(out);
    assert.strictEqual(image.width, 1024);
    assert.strictEqual(image.height, 400);
    assert.strictEqual(calls.at(-1).redirect, "error");
    assert.ok(calls.at(-1).signal instanceof AbortSignal);
});

function fakeGuild({ id = "g5", channelExists = true, canPost = true, send = async () => {} } = {}) {
    const channel = { id: "chan", send, permissionsFor: () => ({ has: () => canPost }) };
    return {
        id, name: "Orbit", memberCount: 12,
        members: { me: { id: "bot" } },
        channels: { cache: new Map(channelExists ? [["chan", channel]] : []) },
        channel,
    };
}
const fakeMember = (guild) => ({ id: "7", user: { bot: false }, displayName: "Heekki", guild, displayAvatarURL: () => null });

test("buildGreeting: join may only ping the new member, leave pings nobody", async () => {
    const { buildGreeting } = require("../lib/greetings/post");
    const { getGreetSettings } = require("../lib/db");
    const guild = fakeGuild();
    const settings = { ...(await getGreetSettings("x")), joinMessage: "Hi {user} @everyone <@&9> <@42>" };
    const join = await buildGreeting(fakeMember(guild), "join", settings);
    assert.ok(join.content.includes("<@7>"));
    assert.deepStrictEqual(join.allowedMentions, { users: ["7"] });
    assert.strictEqual(join.files[0].name, "welcome.png");
    const leave = await buildGreeting(fakeMember(guild), "leave", settings);
    assert.deepStrictEqual(leave.allowedMentions, { users: [] });
    assert.strictEqual(leave.content, "Heekki left the Orbit. 🌙");
});

test("greetingProblems explains why a greeting wouldn't post", async () => {
    const { greetingProblems } = require("../lib/greetings/post");
    const { getGreetSettings } = require("../lib/db");
    const base = { ...(await getGreetSettings("x")), channelId: "chan" };
    assert.deepStrictEqual(greetingProblems(fakeGuild(), base, "join"), []);
    assert.deepStrictEqual(greetingProblems(fakeGuild(), { ...base, channelId: null }, "join"), ["No greeting channel is set (use set-greet-channel)."]);
    assert.deepStrictEqual(greetingProblems(fakeGuild({ channelExists: false }), base, "join"), ["The greeting channel no longer exists."]);
    assert.deepStrictEqual(greetingProblems(fakeGuild(), { ...base, joinEnabled: false }, "join"), ["The join greeting is switched off."]);
    assert.deepStrictEqual(greetingProblems(fakeGuild(), base, "leave"), ["The leave greeting is switched off."]); // leave is off by default
    assert.deepStrictEqual(greetingProblems(fakeGuild({ canPost: false }), base, "join"),
        ["I'm missing View Channel / Send Messages / Attach Files in <#chan>."]);
});

test("sendGreeting posts when set up, and only logs when sending fails", async (t) => {
    const { sendGreeting } = require("../lib/greetings/post");
    const { updateGreetSettings } = require("../lib/db");
    const sent = [];
    const ok = fakeGuild({ id: "g-ok", send: async (p) => sent.push(p) });
    await updateGreetSettings("g-ok", { channelId: "chan" });
    await sendGreeting(fakeMember(ok), "join");
    assert.strictEqual(sent.length, 1);
    await sendGreeting(fakeMember(ok), "leave"); // leave is off: nothing posted
    assert.strictEqual(sent.length, 1);

    const logged = t.mock.method(console, "error", () => {});
    const broken = fakeGuild({ id: "g-bad", send: async () => { throw new Error("Missing Permissions"); } });
    await updateGreetSettings("g-bad", { channelId: "chan" });
    await sendGreeting(fakeMember(broken), "join"); // must not throw
    assert.strictEqual(logged.mock.callCount(), 1);
});

const GREET_COMMANDS = ["set-greet-channel", "set-join-message", "set-leave-message", "set-greet-bg", "set-greet-colors",
    "toggle-join-greet", "toggle-leave-greet", "greet-settings", "testjoin", "testleave", "toggle-birthday-posts"];
const greetCmd = (name) => require(`../commands/greetings/${name}.js`);

function fakeMessage({ guildId, admin = true, args = [], attachments = [] }) {
    const { Collection } = require("discord.js");
    const replies = [];
    const textChannel = { id: "chan", type: 0, send: async () => {}, permissionsFor: () => ({ has: () => true }) };
    const voiceChannel = { id: "vc", type: 2 };
    const guild = { id: guildId, name: "Orbit", memberCount: 12, members: { me: { id: "bot" } },
        channels: { cache: new Map([["chan", textChannel], ["vc", voiceChannel]]) } };
    const member = { id: "7", user: { bot: false }, displayName: "Heekki", guild, displayAvatarURL: () => null,
        permissions: { has: () => admin } };
    const send = async (p) => { replies.push(p); return {}; };
    return { message: { guild, member, author: { id: "7" }, attachments: new Collection(attachments.map((a) => [a.id, a])),
        reply: send, channel: { id: "here", send } }, replies, args };
}
const run = async (name, opts) => { const f = fakeMessage(opts); await greetCmd(name).run({}, f.message, f.args); return f.replies; };
const text = (reply) => (typeof reply === "string" ? reply : reply.content ?? "");

test("greetings commands: all eleven exist, live in the greetings category, and are admin-only", async () => {
    const { PermissionFlagsBits } = require("discord.js");
    const fs = require("node:fs");
    const files = fs.readdirSync(require("node:path").join(__dirname, "..", "commands", "greetings")).map((f) => f.replace(/\.js$/, "")).sort();
    assert.deepStrictEqual(files, [...GREET_COMMANDS].sort());
    for (const name of GREET_COMMANDS) {
        assert.strictEqual(greetCmd(name).name, name);
        assert.strictEqual(greetCmd(name).defaultMemberPermissions, PermissionFlagsBits.ManageGuild.toString(), name);
    }
});

test("greetings commands refuse members without Manage Server", async () => {
    const { getGreetSettings } = require("../lib/db");
    const replies = await run("set-join-message", { guildId: "c1", admin: false, args: ["Hacked", "{user}"] });
    assert.strictEqual(text(replies[0]), "You need the Manage Server permission to change greetings.");
    assert.strictEqual((await getGreetSettings("c1")).joinMessage, "Welcome to the Orbit, {user}! 🌙");
});

test("set-join-message saves text, refuses >500 chars, and reset restores the default", async () => {
    const { getGreetSettings } = require("../lib/db");
    await run("set-join-message", { guildId: "c2", args: ["Hi", "{user}", "@everyone"] });
    assert.strictEqual((await getGreetSettings("c2")).joinMessage, "Hi {user} @everyone");
    await run("set-join-message", { guildId: "c2", args: ["x".repeat(501)] });
    assert.strictEqual((await getGreetSettings("c2")).joinMessage, "Hi {user} @everyone");
    await run("set-join-message", { guildId: "c2", args: ["RESET"] });
    assert.strictEqual((await getGreetSettings("c2")).joinMessage, "Welcome to the Orbit, {user}! 🌙");
});

test("set-greet-channel accepts a text channel and refuses a voice channel", async () => {
    const { getGreetSettings } = require("../lib/db");
    await run("set-greet-channel", { guildId: "c3", args: ["<#vc>"] });
    assert.strictEqual((await getGreetSettings("c3")).channelId, null);
    const replies = await run("set-greet-channel", { guildId: "c3", args: ["<#chan>"] });
    assert.strictEqual((await getGreetSettings("c3")).channelId, "chan");
    assert.strictEqual(text(replies[0]), "Greetings will be posted in <#chan>.");
});

test("set-greet-colors needs exactly 12 colours; reset restores the defaults", async () => {
    const { getGreetSettings } = require("../lib/db");
    const { DEFAULT_COLORS } = require("../lib/greetings/format");
    await run("set-greet-colors", { guildId: "c4", args: Array(11).fill("#123456") });
    assert.deepStrictEqual((await getGreetSettings("c4")).colors, DEFAULT_COLORS);
    await run("set-greet-colors", { guildId: "c4", args: Array(12).fill("#123456") });
    assert.deepStrictEqual((await getGreetSettings("c4")).colors, Array(12).fill("#123456"));
    await run("set-greet-colors", { guildId: "c4", args: ["reset"] });
    assert.deepStrictEqual((await getGreetSettings("c4")).colors, DEFAULT_COLORS);
});

test("set-greet-bg refuses non-Discord links and reset clears the background", async () => {
    const { getGreetSettings, updateGreetSettings } = require("../lib/db");
    const replies = await run("set-greet-bg", { guildId: "c5", args: ["https://evil.com/x.png"] });
    assert.strictEqual(text(replies[0]), "Only Discord image uploads or Discord image links are allowed.");
    await updateGreetSettings("c5", { background: Buffer.from([1]) });
    await run("set-greet-bg", { guildId: "c5", args: ["reset"] });
    assert.strictEqual((await getGreetSettings("c5")).hasBackground, false);
});

test("toggle-join-greet flips the setting", async () => {
    const { getGreetSettings } = require("../lib/db");
    await run("toggle-join-greet", { guildId: "c6" });
    assert.strictEqual((await getGreetSettings("c6")).joinEnabled, false);
    await run("toggle-join-greet", { guildId: "c6" });
    assert.strictEqual((await getGreetSettings("c6")).joinEnabled, true);
});

test("testjoin previews in the current channel and warns when the real greeting won't post", async () => {
    const replies = await run("testjoin", { guildId: "c7" });
    assert.strictEqual(replies[0].files[0].name, "welcome.png");
    assert.ok(text(replies[1]).startsWith("⚠️ The real greeting won't post yet:"));
    assert.ok(text(replies[1]).includes("No greeting channel is set"));
});

test("greet-settings shows an embed", async () => {
    const replies = await run("greet-settings", { guildId: "c8" });
    assert.ok(replies[0].embeds?.length === 1);
});

test("downloadBackground refuses images whose pixel size would use too much memory, before decoding them", async () => {
    const { downloadBackground, imageSize } = require("../lib/greetings/background");
    const { createCanvas } = require("@napi-rs/canvas");
    // A tiny file whose PNG header claims 30000x30000 pixels (would need ~3.6 GB once decoded).
    const bomb = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bomb, 0);
    bomb.writeUInt32BE(13, 8); bomb.write("IHDR", 12, "ascii");
    bomb.writeUInt32BE(30000, 16); bomb.writeUInt32BE(30000, 20);
    assert.deepStrictEqual(imageSize(bomb), { width: 30000, height: 30000 });
    const fake = (body) => async () => new Response(body, { headers: { "content-type": "image/png" } });
    await assert.rejects(downloadBackground("https://cdn.discordapp.com/a.png", fake(bomb)), /too large/);

    // Real PNG / JPEG / WebP headers are read correctly.
    const canvas = createCanvas(321, 123);
    for (const format of ["png", "jpeg", "webp"])
        assert.deepStrictEqual(imageSize(await canvas.encode(format)), { width: 321, height: 123 }, format);
    assert.strictEqual(imageSize(Buffer.from("not an image")), null);
});

test("testjoin still explains problems when the preview itself can't be posted", async () => {
    const f = fakeMessage({ guildId: "c9" });
    const sent = [];
    f.message.reply = async (p) => { if (p.files) throw new Error("Missing Permissions"); sent.push(p); };
    f.message.channel.send = async (p) => { sent.push(p); };
    await greetCmd("testjoin").run({}, f.message, []);
    const warning = sent.map(text).join("\n");
    assert.ok(warning.includes("I couldn't post the preview here: Missing Permissions"), warning);
    assert.ok(warning.includes("No greeting channel is set"), warning);
});

test("default star colours are LOONA's official member colours (from the LOONA wiki)", async () => {
    const { DEFAULT_COLORS } = require("../lib/greetings/format");
    assert.deepStrictEqual(DEFAULT_COLORS, ["#F4028E", "#FFCB07", "#01954A", "#F47021", "#F4A1B5", "#EB1326",
        "#1313D6", "#7632A0", "#7A0332", "#F7917E", "#39BB9D", "#787A7D"]);
});
