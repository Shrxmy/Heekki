const { randomInt } = require("node:crypto");
const loona = require("../../lib/loona");
const db = require("../../lib/db");

const COOLDOWN_S = 3600, MIN = 20, MAX = 60;
const LINES = [
    (m, song) => `${m} ran through the "${song}" choreo with you.`,
    (m, song) => `You practised harmonies for "${song}" with ${m}.`,
    (m) => `${m} filmed a dance challenge with you.`,
    (m) => `You and ${m} rehearsed for the comeback stage.`,
    (m, song) => `${m} taught you the point move from "${song}".`,
];
const minutes = (ms) => Math.max(1, Math.ceil(ms / 60_000));

module.exports = {
    name: "practice",
    description: `Practise with a LOONA member once an hour for ${MIN}-${MAX} moon coins.`,
    aliases: ["work", "rehearse"],
    run: async (client, message, args) => {
        const member = loona.members[randomInt(loona.members.length)];
        const coins = randomInt(MIN, MAX + 1);
        const got = await db.rewardAfterCooldown(message.guild.id, message.author.id, "practice", COOLDOWN_S, coins);
        if (got.waitMs !== undefined) return message.reply(`You're still catching your breath. Practise again in **${minutes(got.waitMs)} min** 🌙`);
        const line = LINES[randomInt(LINES.length)](member.name, member.single.replace(/[“”"]/g, ""));
        return message.reply(`${member.animal.split(" ")[0]} ${line} **+${coins}** moon coins · Balance **${got.balance}**`);
    },
};
