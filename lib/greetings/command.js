// Shared wrapper for the greetings commands: Manage Server only, for both slash and prefix use.
const { PermissionFlagsBits } = require("discord.js");

const MANAGE = PermissionFlagsBits.ManageGuild;
const NO_PERMISSION = "You need the Manage Server permission to change greetings.";

// Admin-typed text is echoed back; it must not ping anyone.
const quiet = (content, extra = {}) => ({ content, allowedMentions: { parse: [], repliedUser: true }, ...extra });

const greetCommand = (definition) => ({
    ...definition,
    defaultMemberPermissions: MANAGE.toString(), // hides the slash command from members who can't use it
    run: (client, message, args) => (message.member.permissions.has(MANAGE)
        ? definition.run(client, message, args)
        : message.reply(NO_PERMISSION)), // prefix commands have no Discord-side permission gate
});

const isReset = (args) => args.length === 1 && args[0].toLowerCase() === "reset";

module.exports = { greetCommand, quiet, isReset };
