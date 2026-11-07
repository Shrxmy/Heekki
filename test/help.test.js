process.env.DB_PATH = ":memory:";
const test = require("node:test");
const assert = require("node:assert");
const { ApplicationCommandOptionType: T } = require("discord.js");

const commands = [
    { directory: "music", name: "play", description: "Plays a requested song.", aliases: ["p"], options: [{ name: "query", type: T.String, required: true }] },
    { directory: "music", name: "skip", description: "Skips a song.", aliases: [], options: [{ name: "number", type: T.Integer }] },
    { directory: "fun", name: "roll", description: "Roll dice.", aliases: ["dice"] },
    { directory: "greetings", name: "testjoin", description: "Previews.", aliases: [], defaultMemberPermissions: "32" },
    { directory: "zzz", name: "odd", description: "Odd one.", aliases: [] },
];
const help = () => require("../commands/utils/help");

test("usage shows required <args> and optional [args] for prefix and slash", () => {
    assert.strictEqual(help().usage(commands[0], "-"), "`-play <query>` or `/play query:`");
    assert.strictEqual(help().usage(commands[1], "!"), "`!skip [number]` or `/skip [number:]`");
    assert.strictEqual(help().usage(commands[2], "-"), "`-roll` or `/roll`");
});

test("home page lists every category in a fixed order with command counts", () => {
    const embed = help().homeEmbed(commands, { prefix: "-", botName: "Heekki" }).toJSON();
    assert.ok(embed.title.includes("Heekki"));
    assert.ok(embed.description.includes("`-`") && embed.description.includes("`/`"));
    const lines = embed.fields.map((f) => f.name);
    assert.deepStrictEqual(lines, ["Music", "Fun & Games", "Greetings", "Zzz"]);
    assert.ok(embed.fields[0].value.includes("2 commands"));
    assert.ok(embed.fields[1].value.includes("1 command") && !embed.fields[1].value.includes("1 commands"));
});

test("category page lists commands with descriptions and a LOONA colour footer", () => {
    const embed = help().categoryEmbed(commands, "music", "-").toJSON();
    assert.strictEqual(embed.title, "Music");
    assert.ok(embed.description.includes("`play` Plays a requested song."));
    assert.ok(embed.description.includes("`skip` Skips a song."));
    assert.match(embed.footer.text, /^Orbit colour: /);
    const greet = help().categoryEmbed(commands, "greetings", "-").toJSON();
    assert.ok(greet.description.includes("Manage Server"));
});

test("help <command> finds commands by name or alias, and explains unknown ones", () => {
    const byAlias = help().commandEmbed(commands, "P", "-").toJSON();
    assert.strictEqual(byAlias.title, "play");
    assert.ok(byAlias.fields.some((f) => f.name === "Usage" && f.value === "`-play <query>` or `/play query:`"));
    assert.ok(byAlias.fields.some((f) => f.name === "Aliases" && f.value === "`p`"));
    assert.strictEqual(help().commandEmbed(commands, "nope", "-"), null);
});

test("the help menu uses at most one emoji in total", () => {
    const embed = JSON.stringify(help().homeEmbed(commands, { prefix: "-", botName: "Heekki" }).toJSON());
    const menu = JSON.stringify(help().menu(commands, false).map((r) => r.toJSON()));
    const emoji = (embed + menu).match(/\p{Extended_Pictographic}/gu) ?? [];
    assert.ok(emoji.length <= 1, `found ${emoji.join("")}`);
});
