const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");

const dir = path.join(__dirname, "..", "commands");
const commands = fs.readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith(".js"))
    .map((f) => require(path.join(dir, f)))
    .filter((c) => c.name);

test("every command makes a slash definition Discord accepts", () => {
    const { toSlashData } = require("../handler");
    const name = /^[-_\p{Ll}\p{N}]{1,32}$/u;
    const slash = commands.map(toSlashData);
    assert.ok(slash.length <= 100);
    for (const c of slash) {
        assert.match(c.name, name, c.name);
        assert.ok(c.description?.length >= 1 && c.description.length <= 100, `${c.name} description`);
        const firstOptional = c.options.findIndex((o) => !o.required);
        assert.ok(firstOptional === -1 || c.options.slice(firstOptional).every((o) => !o.required), `${c.name}: required options must come first`);
        assert.strictEqual(new Set(c.options.map((o) => o.name)).size, c.options.length, `${c.name}: option names must be unique`);
        for (const o of c.options) {
            assert.match(o.name, name, `${c.name}.${o.name}`);
            assert.ok(o.description.length >= 1 && o.description.length <= 100, `${c.name}.${o.name} description`);
        }
    }
});

test("tic-tac-toe winner", () => {
    const { winner } = require("../commands/fun/tictactoe");
    const b = (s) => [...s].map((c) => (c === "." ? null : c));
    assert.strictEqual(winner(b("XXX.OO...")), "X");
    assert.strictEqual(winner(b("O..XO.X.O")), "O"); // diagonal
    assert.strictEqual(winner(b("XOXXOOOXX")), "draw");
    assert.strictEqual(winner(b("XO.......")), null);
});

test("rock paper scissors outcome", () => {
    const { outcome } = require("../commands/fun/rps");
    assert.strictEqual(outcome("rock", "scissors"), 1);
    assert.strictEqual(outcome("rock", "paper"), -1);
    assert.strictEqual(outcome("paper", "paper"), 0);
});

test("dice parsing", () => {
    const { parseDice } = require("../commands/fun/roll");
    assert.deepStrictEqual(parseDice(), { count: 1, sides: 6 });
    assert.deepStrictEqual(parseDice("2d6"), { count: 2, sides: 6 });
    assert.deepStrictEqual(parseDice("D20"), { count: 1, sides: 20 });
    assert.deepStrictEqual(parseDice("100"), { count: 1, sides: 100 });
    for (const bad of ["0d6", "21d6", "d1", "abc", "2d", "-3"]) assert.strictEqual(parseDice(bad), null, bad);
});

test("slash adapter: first reply edits the deferred response, later ones follow up", async () => {
    const { asMessage } = require("../handler/slashAdapter");
    const calls = [];
    const interaction = {
        guild: {}, member: {}, user: { id: "1" }, channelId: "c",
        editReply: async (o) => calls.push(["edit", o]),
        followUp: async (o) => calls.push(["follow", o]),
        options: { data: [] },
    };
    const msg = asMessage(interaction);
    await msg.reply("hi");
    await msg.channel.send({ embeds: [] });
    assert.deepStrictEqual(calls, [["edit", { content: "hi" }], ["follow", { embeds: [] }]]);
    assert.strictEqual(msg.channel.id, "c");
    assert.strictEqual(msg.attachments.size, 0);
});

test("slash adapter: args follow the declared option order; attachments go to message.attachments", () => {
    const { asMessage, toArgs } = require("../handler/slashAdapter");
    const interaction = {
        guild: {}, member: {}, user: { id: "1" }, channelId: "c",
        options: { data: [
            { name: "b", type: 3, value: "x" },
            { name: "img", type: 11, value: "999", attachment: { id: "999", url: "https://cdn.discordapp.com/a.png" } },
            { name: "a", type: 4, value: 0 },
        ] },
    };
    const declared = [{ name: "a" }, { name: "img", type: 11 }, { name: "b" }];
    assert.deepStrictEqual(toArgs(interaction, declared), ["0", "x"]); // 0 must survive (seek 0, bassboost 0)
    assert.deepStrictEqual(toArgs({ options: { data: [{ name: "b", type: 3, value: "y" }] } }, declared), ["y"]); // skipped optional "a"
    assert.strictEqual(asMessage(interaction).attachments.first().url, "https://cdn.discordapp.com/a.png");
});

test("bot leaves after 3 minutes alone in voice, and stays if someone returns", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const client = new EventEmitter();
    client.lavalink = new EventEmitter();
    client.user = { displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png" };
    const sent = [];
    client.sendToPlayerChannel = (_, embed) => sent.push(embed.data.author.name);
    let destroyed = 0;
    let humans = 1;
    const player = { guildId: "g", voiceChannelId: "vc", destroy: async () => { destroyed++; client.lavalink.emit("playerDestroy", player); } };
    client.lavalink.getPlayer = () => (destroyed ? undefined : player);
    const members = { filter: () => ({ size: humans }) };
    const guild = { id: "g", channels: { cache: new Map([["vc", { members }]]) } };
    const update = () => client.emit("voiceStateUpdate", {}, { guild });

    const indexPath = require.resolve("../index");
    require.cache[indexPath] = { id: indexPath, filename: indexPath, loaded: true, exports: client };
    const { ALONE_LEAVE_MS } = require("../events/voiceStateUpdate");
    assert.strictEqual(ALONE_LEAVE_MS, 180_000);

    humans = 0; update();                 // last person leaves
    t.mock.timers.tick(ALONE_LEAVE_MS - 1);
    humans = 1; update();                 // someone comes back just in time
    t.mock.timers.tick(ALONE_LEAVE_MS * 2);
    assert.strictEqual(destroyed, 0, "stays while someone is there");

    humans = 0; update();
    update();                             // repeated updates don't restart the 3 minutes
    t.mock.timers.tick(ALONE_LEAVE_MS);
    await new Promise((r) => setImmediate(r)); // let destroy() resolve before the goodbye message
    assert.strictEqual(destroyed, 1, "leaves after 3 minutes alone");
    assert.deepStrictEqual(sent, ["🌙 Nobody was listening, so I left the voice channel. Bye, Orbit!"]);
});

test("tic-tac-toe game: rejected clicks don't count, moves apply in order, win ends it", async () => {
    const { EventEmitter } = require("node:events");
    const ttt = require("../commands/fun/tictactoe");
    const user = (id) => ({ id, bot: false, toString: () => `<@${id}>` });
    const alice = user("111111111111111111"), bob = user("222222222222222222"), eve = user("333333333333333333");
    const log = [];
    let collector, collectorOptions;
    const game = {
        // like discord.js: the filter runs first, and only clicks that pass reach "collect"
        createMessageComponentCollector: (options) => {
            collectorOptions = options;
            collector = Object.assign(new EventEmitter(), { ended: false, stop(reason) { this.ended = true; this.emit("end", null, reason); } });
            return collector;
        },
        edit: async (o) => log.push(["edit", o.content]),
    };
    const message = {
        author: alice,
        guild: { members: { fetch: async (id) => ({ id, user: bob }) } },
        reply: async () => game,
    };
    await ttt.run({}, message, [`<@${bob.id}>`]);
    assert.strictEqual(collectorOptions.idle, 60_000);

    const click = (who, cell) => {
        const i = {
            user: who, customId: `ttt-${cell}`,
            reply: async (o) => log.push(["private", who.id, o.content]),
            update: async (o) => { await new Promise((r) => setTimeout(r, 5)); log.push(["update", o.content.split("\n")[1]]); },
            deferUpdate: async () => log.push(["ignored", who.id]),
        };
        if (collectorOptions.filter(i)) collector.emit("collect", i);
    };
    click(eve, 4);                         // spectator: rejected by the filter, never collected
    click(bob, 4);                         // wrong turn: rejected
    const updates = () => log.filter((l) => l[0] === "update").length;
    const waitForUpdates = async (n) => { while (updates() < n) await new Promise((r) => setTimeout(r, 1)); };
    click(alice, 0);
    await new Promise((r) => setImmediate(r));
    click(bob, 3);                         // overlaps: alice's board update is still being sent
    await waitForUpdates(2);
    click(alice, 1); await waitForUpdates(3);
    click(bob, 4); await waitForUpdates(4);
    click(alice, 2);
    await new Promise((r) => setTimeout(r, 100));

    assert.deepStrictEqual(log.filter((l) => l[0] === "private").map((l) => l[2]), ["This isn't your game.", "Wait for your turn."]);
    assert.deepStrictEqual(log.filter((l) => l[0] === "update").map((l) => l[1]), [
        `<@${bob.id}>'s turn (⭕)`, `<@${alice.id}>'s turn (❌)`, `<@${bob.id}>'s turn (⭕)`, `<@${alice.id}>'s turn (❌)`, `<@${alice.id}> wins! 🎉`,
    ]);
    assert.ok(collector.ended);
    assert.ok(!log.some((l) => l[0] === "edit"), "no timeout message after a win");
});
