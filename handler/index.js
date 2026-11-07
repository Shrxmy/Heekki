const fs = require("node:fs");
const path = require("node:path");
const { Client, Events, InteractionContextType } = require("discord.js");

const root = path.join(__dirname, "..");

// Sorted so command/alias precedence is stable (same order glob used to give).
const jsFiles = (dir) =>
    fs.readdirSync(path.join(root, dir), { recursive: true })
        .filter((f) => f.endsWith(".js"))
        .sort()
        .map((f) => path.join(root, dir, f));

// Every prefix command doubles as a slash command; `options` holds its slash options.
const toSlashData = (cmd) => ({
    name: cmd.name,
    description: cmd.description,
    options: cmd.options ?? [],
    default_member_permissions: cmd.defaultMemberPermissions ?? null,
    contexts: [InteractionContextType.Guild],
});

/**
 * @param {Client} client
 */
const loadHandlers = (client) => {
    // Commands
    for (const value of jsFiles("commands")) {
        const file = require(value);
        const directory = path.basename(path.dirname(value));

        if (file.name) {
            const properties = { directory, ...file };
            client.commands.set(file.name, properties);
        }
    }

    // Events
    jsFiles("events").forEach((value) => require(value));

    client.once(Events.ClientReady, async () => {
        // Register for all the guilds the bot is in (the old code was hard-coded to one guild and crashed elsewhere)
        await client.application.commands
            .set(client.commands.map(toSlashData))
            .then((cmds) => console.log(`Registered ${cmds.size} slash commands.`))
            .catch((err) => console.error("Failed to register slash commands:", err));
    });
};

module.exports = loadHandlers;
module.exports.toSlashData = toSlashData;
