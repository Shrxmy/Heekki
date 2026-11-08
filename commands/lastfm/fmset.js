const { ApplicationCommandOptionType } = require("discord.js");
const lastfm = require("../../lib/lastfm");
const { setLastfm } = require("../../lib/db");

module.exports = {
    name: "fmset",
    description: 'Links your Last.fm account so the fm commands know who you are.',
    aliases: ['fmlogin'],
    options: [{ name: 'username', description: 'Your Last.fm username', type: ApplicationCommandOptionType.String, max_length: 15, required: true }],
    run: async (client, message, args) => {
        if (!lastfm.hasKey()) return message.reply(lastfm.NO_KEY);
        const name = args[0] ?? "";
        if (!lastfm.validUsername(name)) return message.reply("Give me your Last.fm username, like `fmset orbit12` 🌙");
        let user;
        try {
            user = (await lastfm.call("user.getInfo", { user: name })).user;
        } catch (err) {
            return message.reply(err.notFound ? `I couldn't find a Last.fm user called \`${name}\` 🌙` : "Last.fm didn't answer, try again in a bit 🌙");
        }
        setLastfm(message.author.id, user.name); // Last.fm's own spelling of the name
        return message.reply(`🌙 Linked you to **${lastfm.clean(user.name)}** on Last.fm (${lastfm.plural(user.playcount ?? 0, "scrobble")}). Try \`fm\`, Orbit!`);
    }
};
