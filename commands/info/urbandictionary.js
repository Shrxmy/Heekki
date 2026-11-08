const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const http = require("../../lib/info/http");
const { truncate } = require("../../lib/info/format");
const { quiet } = require("../../lib/fun/target");

const unlink = (s) => String(s ?? "").replace(/\[([^\]]*)\]/g, "$1"); // Urban Dictionary marks links as [word]

module.exports = {
    name: "urbandictionary",
    description: 'Looks up a word on Urban Dictionary (age-restricted channels only).',
    aliases: ['urban', 'ud'],
    options: [{ name: 'term', description: 'Word or phrase', type: ApplicationCommandOptionType.String, max_length: 80, required: true }],
    run: async (client, message, args) => {
        // Many definitions are crude, so this stays in channels marked age-restricted (NSFW).
        if (!message.guild.channels.cache.get(message.channel.id)?.nsfw) return message.reply("Urban Dictionary only works in age-restricted (NSFW) channels.");
        const term = args.join(" ").trim();
        if (!term) return message.reply("Which word? Like `urban orbit`.");
        let entry;
        try { entry = (await http.getJson(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`)).list?.[0]; } catch { return message.reply("Urban Dictionary didn't answer, try again in a bit."); }
        if (!entry) return message.reply(quiet(`No definition for "${truncate(term, 60)}".`));
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#F47021")
            .setTitle(truncate(entry.word, 256))
            .setURL(entry.permalink)
            .setDescription(truncate(unlink(entry.definition), 1500))
            .addFields(...(entry.example ? [{ name: "Example", value: truncate(unlink(entry.example), 1000) }] : []))
            .setFooter({ text: `👍 ${entry.thumbs_up} · 👎 ${entry.thumbs_down}` })] });
    }
};
