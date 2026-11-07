const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, ApplicationCommandOptionType } = require("discord.js");

const EMOJI = { rock: "🪨", paper: "📄", scissors: "✂️" };
const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };

// 1 if a beats b, -1 if b beats a, 0 for a tie.
const outcome = (a, b) => (a === b ? 0 : BEATS[a] === b ? 1 : -1);

const buttons = (disabled) => [new ActionRowBuilder().addComponents(
    Object.entries(EMOJI).map(([pick, emoji]) => new ButtonBuilder()
        .setCustomId(`rps-${pick}`)
        .setEmoji(emoji)
        .setLabel(pick[0].toUpperCase() + pick.slice(1))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)))];

module.exports = {
    name: "rps",
    description: 'Rock paper scissors against the bot, or challenge a member.',
    aliases: ['rockpaperscissors'],
    options: [{ name: 'opponent', description: 'Who to challenge (leave empty to play the bot)', type: ApplicationCommandOptionType.User }],
    outcome,
    run: async (client, message, args) => {
        const id = args[0]?.match(/\d{17,20}/)?.[0];
        const opponent = id ? (await message.guild.members.fetch(id).catch(() => null))?.user : client.user;
        if (!opponent) return message.reply("I couldn't find that member.");
        const vsBot = opponent.id === client.user.id;
        if (opponent.id === message.author.id || (opponent.bot && !vsBot))
            return message.reply("Pick another (human) member, or leave it empty to play me.");

        const players = [message.author, opponent];
        const picks = new Map();
        if (vsBot) picks.set(client.user.id, Object.keys(EMOJI)[Math.floor(Math.random() * 3)]);

        const game = await message.reply({ content: `${players[0]} vs ${players[1]}: pick one!`, components: buttons(false) });
        const collector = game.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60_000 });

        collector.on("collect", async (i) => {
            if (!players.some((p) => p.id === i.user.id))
                return i.reply({ content: "This isn't your game.", flags: MessageFlags.Ephemeral });
            if (picks.has(i.user.id))
                return i.reply({ content: "You already picked.", flags: MessageFlags.Ephemeral });

            picks.set(i.user.id, i.customId.slice(4));
            if (picks.size < 2) {
                const waitingFor = players.find((p) => !picks.has(p.id));
                return i.reply({ content: `You picked ${EMOJI[picks.get(i.user.id)]}. Waiting for ${waitingFor}...`, flags: MessageFlags.Ephemeral });
            }

            collector.stop("finished");
            const [a, b] = players.map((p) => picks.get(p.id));
            const result = outcome(a, b);
            const text = `${players[0]} ${EMOJI[a]} vs ${EMOJI[b]} ${players[1]}\n` +
                (result === 0 ? "It's a tie!" : `${players[result > 0 ? 0 : 1]} wins! 🎉`);
            return i.update({ content: text, components: buttons(true) });
        });

        collector.on("end", (_, reason) => {
            if (reason === "finished") return;
            game.edit({ content: `${players[0]} vs ${players[1]}: nobody picked in time.`, components: buttons(true) }).catch(() => {});
        });
    }
};
