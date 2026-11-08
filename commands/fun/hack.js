const { ApplicationCommandOptionType } = require("discord.js");
const { setTimeout: sleep } = require("node:timers/promises");
const { targetMember, quiet } = require("../../lib/fun/target");

const BIASES = ["Heejin", "Hyunjin", "Haseul", "Yeojin", "ViVi", "Kim Lip", "JinSoul", "Choerry", "Yves", "Chuu", "Go Won", "Olivia Hye"];
const STEP_MS = 1500;

/** The prank's lines. Everything is made up: no real data is ever looked up. */
const hackSteps = (name, bias) => [
    `Hacking **${name}**...`,
    `Bypassing the Orbit firewall... done`,
    `Finding their bias... **${bias}**`,
    `Downloading their photocard collection... 42%`,
    `Leaking their music stats: 100% LOONA`,
    `Done! **${name}** has been "hacked". (It's a joke, nothing actually happened.)`,
];

module.exports = {
    name: "hack",
    description: "Pretend to hack someone (a harmless joke).",
    aliases: [],
    options: [{ name: 'user', description: 'Who to "hack"', type: ApplicationCommandOptionType.User, required: true }],
    hackSteps, STEP_MS,
    run: async (client, message, args) => {
        if (!args[0]) return message.reply("Mention someone to hack, like `hack @friend`.");
        const member = await targetMember(message, args[0]);
        if (!member) return message.reply("I couldn't find that member.");
        const [first, ...rest] = hackSteps(member.displayName, BIASES[Math.floor(Math.random() * BIASES.length)]);
        const sent = await message.reply(quiet(first));
        for (const line of rest) {
            await sleep(module.exports.STEP_MS);
            await sent.edit(quiet(line)).catch(() => {});
        }
    }
};
