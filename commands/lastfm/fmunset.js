const { removeLastfm } = require("../../lib/db");

module.exports = {
    name: "fmunset",
    description: 'Unlinks your Last.fm account from the bot.',
    aliases: ['fmlogout'],
    run: async (client, message, args) => {
        return message.reply(await removeLastfm(message.author.id)
            ? "🌙 Unlinked your Last.fm. Link it again any time with `fmset`."
            : "You haven't linked a Last.fm account 🌙");
    }
};
