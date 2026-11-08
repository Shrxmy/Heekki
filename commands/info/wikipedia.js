const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const http = require("../../lib/info/http");
const { truncate } = require("../../lib/info/format");
const { quiet } = require("../../lib/fun/target");

module.exports = {
    name: "wikipedia",
    description: 'Summarizes a Wikipedia article.',
    aliases: ['wiki'],
    options: [{ name: 'topic', description: 'What to look up', type: ApplicationCommandOptionType.String, max_length: 100, required: true }],
    run: async (client, message, args) => {
        const query = args.join(" ").trim();
        if (!query) return message.reply("What should I look up? Like `wikipedia LOONA`.");
        let page;
        try {
            const [, titles] = await http.getJson(`https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=1&search=${encodeURIComponent(query)}`);
            if (!titles?.length) return message.reply(quiet(`I couldn't find a Wikipedia article for "${truncate(query, 60)}".`));
            page = await http.getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titles[0].replace(/ /g, "_"))}`);
        } catch {
            return message.reply("Wikipedia didn't answer, try again in a bit.");
        }
        if (page.type === "disambiguation") return message.reply(quiet(`"${page.title}" can mean several things. Try something more specific.`));
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#787A7D")
            .setTitle(truncate(page.title, 256))
            .setURL(page.content_urls?.desktop?.page ?? null)
            .setDescription(truncate(page.extract, 1000))
            .setThumbnail(page.thumbnail?.source ?? null)
            .setFooter({ text: "From Wikipedia (CC BY-SA)" })] });
    }
};
