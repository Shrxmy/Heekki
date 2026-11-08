const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const http = require("../../lib/info/http");
const { decodeEntities, truncate } = require("../../lib/info/format");

/** Pulls title/link/date out of an RSS feed (Google News' feed is simple enough not to need an XML library). */
function parseFeed(xml, max = 5) {
    const tag = (item, name) => decodeEntities(item.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${name}>`, "s"))?.[1] ?? "").trim();
    return [...xml.matchAll(/<item>(.*?)<\/item>/gs)].slice(0, max).map(([, item]) => ({ title: tag(item, "title"), link: tag(item, "link"), date: tag(item, "pubDate") }))
        .filter((s) => s.title && /^https:\/\//.test(s.link));
}

/** One line per story, stopping before the description would pass Discord's 4096-character limit (links count too). */
function storyLines(stories) {
    let out = "";
    for (const s of stories) {
        const when = Number.isFinite(Date.parse(s.date)) ? ` · <t:${Math.floor(Date.parse(s.date) / 1000)}:R>` : "";
        const line = s.link.length <= 1000 ? `[${truncate(s.title, 150).replace(/[[\]]/g, "")}](${s.link})${when}` : `${truncate(s.title, 150)}${when}`;
        if ((out ? out.length + 1 : 0) + line.length > 4096) break;
        out = out ? `${out}\n${line}` : line;
    }
    return out;
}

module.exports = {
    name: "news",
    description: 'Latest news headlines (LOONA by default).',
    aliases: [],
    options: [{ name: 'topic', description: 'What to search news for (default: LOONA)', type: ApplicationCommandOptionType.String, max_length: 80 }],
    parseFeed,
    run: async (client, message, args) => {
        const topic = args.join(" ").trim() || "LOONA";
        let stories;
        try {
            stories = parseFeed(await http.getText(`https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=${encodeURIComponent(topic)}`));
        } catch {
            return message.reply("The news feed didn't answer, try again in a bit.");
        }
        if (!stories.length) return message.reply({ content: `No news found for that.`, allowedMentions: { parse: [] } });
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#EB1326")
            .setTitle(truncate(`News: ${topic}`, 256))
            .setDescription(storyLines(stories))
            .setFooter({ text: "From Google News" })] });
    }
};
