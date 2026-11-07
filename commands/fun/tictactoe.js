const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, ApplicationCommandOptionType } = require("discord.js");

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

// "X" or "O" when someone has three in a row, "draw" when the board is full, otherwise null.
function winner(board) {
    for (const [a, b, c] of LINES)
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    return board.every(Boolean) ? "draw" : null;
}

const STYLE = { X: ButtonStyle.Primary, O: ButtonStyle.Danger };
const boardRows = (board, over) => [0, 1, 2].map((row) =>
    new ActionRowBuilder().addComponents([0, 1, 2].map((col) => {
        const i = row * 3 + col;
        return new ButtonBuilder()
            .setCustomId(`ttt-${i}`)
            .setLabel(board[i] ?? "·")
            .setStyle(STYLE[board[i]] ?? ButtonStyle.Secondary)
            .setDisabled(over || Boolean(board[i]));
    })));

module.exports = {
    name: "tictactoe",
    description: 'Challenge another member to tic-tac-toe.',
    aliases: ['ttt'],
    options: [{ name: 'opponent', description: 'Who you want to play against', type: ApplicationCommandOptionType.User, required: true }],
    winner,
    run: async (client, message, args) => {
        const id = args[0]?.match(/\d{17,20}/)?.[0];
        const opponent = id && await message.guild.members.fetch(id).catch(() => null);
        if (!opponent) return message.reply("Mention someone to play against, like `tictactoe @friend`.");
        if (opponent.user.bot || opponent.id === message.author.id) return message.reply("Pick another (human) member to play against.");

        const players = [message.author, opponent.user]; // the challenger is ❌ and goes first
        const marks = ["X", "O"];
        const board = Array(9).fill(null);
        let turn = 0;
        const status = (text) => `❌ ${players[0]} vs ⭕ ${players[1]}\n${text}`;
        const turnText = () => `${players[turn]}'s turn (${turn ? "⭕" : "❌"})`;

        const game = await message.reply({ content: status(turnText()), components: boardRows(board, false) });
        // Rejected clicks are answered here and never reach "collect", so they don't reset the 60s move timer.
        const filter = (i) => {
            const problem = !players.some((p) => p.id === i.user.id) ? "This isn't your game."
                : i.user.id !== players[turn].id ? "Wait for your turn." : null;
            if (problem) i.reply({ content: problem, flags: MessageFlags.Ephemeral }).catch(() => {});
            return !problem;
        };
        const collector = game.createMessageComponentCollector({ componentType: ComponentType.Button, filter, idle: 60_000 });

        // Moves are handled one at a time so board updates can't reach Discord out of order.
        let moves = Promise.resolve();
        collector.on("collect", (i) => { moves = moves.then(() => play(i)).catch(console.error); });

        const play = async (i) => {
            if (collector.ended || i.user.id !== players[turn].id) return i.deferUpdate();
            const cell = Number(i.customId.slice(4));
            if (board[cell]) return i.deferUpdate();
            board[cell] = marks[turn];

            const result = winner(board);
            if (result) {
                collector.stop("finished");
                const text = result === "draw" ? "It's a draw!" : `${players[turn]} wins! 🎉`;
                return i.update({ content: status(text), components: boardRows(board, true) });
            }
            turn = 1 - turn;
            return i.update({ content: status(turnText()), components: boardRows(board, false) });
        };

        collector.on("end", (_, reason) => {
            if (reason === "finished") return;
            game.edit({ content: status(`Game over: ${players[turn]} didn't move for a minute.`), components: boardRows(board, true) }).catch(() => {});
        });
    }
};
