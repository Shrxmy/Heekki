const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const http = require("../../lib/info/http");
const { stamp, truncate } = require("../../lib/info/format");

module.exports = {
    name: "github",
    description: 'Shows a GitHub profile.',
    aliases: ['gh'],
    options: [{ name: 'username', description: 'GitHub username', type: ApplicationCommandOptionType.String, max_length: 39, required: true }],
    run: async (client, message, args) => {
        const user = args[0] ?? "";
        // Only real usernames reach the URL, so nothing else on api.github.com can be requested.
        if (!/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(user)) return message.reply("Give me a valid GitHub username, like `github octocat`.");
        let p;
        try { p = await http.getJson(`https://api.github.com/users/${user}`); } catch { return message.reply("I couldn't find that GitHub user."); }
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#1313D6")
            .setTitle(truncate(p.name ? `${p.name} (${p.login})` : p.login, 256))
            .setURL(p.html_url)
            .setThumbnail(p.avatar_url)
            .setDescription(truncate(p.bio || "No bio.", 300))
            .addFields(
                { name: "Repos", value: String(p.public_repos), inline: true },
                { name: "Followers", value: String(p.followers), inline: true },
                { name: "Following", value: String(p.following), inline: true },
                { name: "Joined", value: stamp(p.created_at) },
            )] });
    }
};
