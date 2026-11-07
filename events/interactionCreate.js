const { MessageFlags } = require("discord.js");
const client = require("../index");
const { asMessage, toArgs } = require("../handler/slashAdapter");

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const cmd = client.commands.get(interaction.commandName);
    const problem = !cmd ? "That command doesn't exist anymore." : !interaction.guild ? "This command only works inside a server." : null;
    if (problem) return interaction.reply({ content: problem, flags: MessageFlags.Ephemeral }).catch(() => {});

    await interaction.deferReply().catch(() => {});

    try {
        await cmd.run(client, asMessage(interaction), toArgs(interaction, cmd.options));
    } catch (err) {
        console.error(`Slash command "${cmd.name}" failed:`, err);
        interaction.followUp({ content: `Something went wrong: ${err.message}` }).catch(() => {});
    }
});
