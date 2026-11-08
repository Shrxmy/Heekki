const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, MessageFlags } = require("discord.js");

// Free trivia API, no key needed. url3986 encoding avoids HTML entities like &quot; in the text.
const API = "https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986";
const LETTERS = ["A", "B", "C", "D"];

const shuffle = (items) => items
    .map((item) => [Math.random(), item])
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => item);

const answerRow = (answers, reveal) => [new ActionRowBuilder().addComponents(
    answers.map((answer, i) => new ButtonBuilder()
        .setCustomId(`trivia-${i}`)
        .setLabel(`${LETTERS[i]}: ${answer}`.slice(0, 80))
        .setStyle(reveal && i === reveal.correct ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(Boolean(reveal))))];

module.exports = {
    name: "trivia",
    description: 'A trivia question: first person to click the right answer wins.',
    aliases: ['quiz'],
    run: async (client, message, args) => {
        const data = await fetch(API, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()).catch(() => null);
        const q = data?.results?.[0];
        if (!q) return message.reply("I couldn't get a trivia question right now, try again in a few seconds.");

        const answers = shuffle([q.correct_answer, ...q.incorrect_answers]).map(decodeURIComponent);
        const correct = answers.indexOf(decodeURIComponent(q.correct_answer));
        const embed = new EmbedBuilder()
            .setColor('#FFCB07') // HyunJin yellow, the Fun colour in help
            .setAuthor({ name: `${decodeURIComponent(q.category)} · ${q.difficulty}` })
            .setTitle(decodeURIComponent(q.question))
            .setFooter({ text: "First correct click wins. One guess each, 20 seconds." });

        const game = await message.reply({ embeds: [embed], components: answerRow(answers, null) });
        const guessed = new Set();
        const collector = game.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20_000 });

        collector.on("collect", async (i) => {
            if (collector.ended) return i.deferUpdate(); // someone else won a moment earlier
            if (guessed.has(i.user.id))
                return i.reply({ content: "You already guessed.", flags: MessageFlags.Ephemeral });
            guessed.add(i.user.id);
            if (Number(i.customId.slice(7)) !== correct)
                return i.reply({ content: "Wrong answer! ❌", flags: MessageFlags.Ephemeral });

            collector.stop("won");
            embed.setDescription(`${i.user} got it right! 🎉`);
            return i.update({ embeds: [embed], components: answerRow(answers, { correct }) });
        });

        collector.on("end", (_, reason) => {
            if (reason === "won") return;
            embed.setDescription(`Time's up! The answer was **${LETTERS[correct]}: ${answers[correct]}**.`);
            game.edit({ embeds: [embed], components: answerRow(answers, { correct }) }).catch(() => {});
        });
    }
};
