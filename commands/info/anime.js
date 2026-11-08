const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const http = require("../../lib/info/http");
const { stripHtml, truncate } = require("../../lib/info/format");
const { quiet } = require("../../lib/fun/target");

const QUERY = "query($s:String){Media(search:$s,type:ANIME,isAdult:false){title{romaji english} averageScore episodes status siteUrl coverImage{large} description(asHtml:false) genres seasonYear}}";
const STATUS = { FINISHED: "Finished", RELEASING: "Airing", NOT_YET_RELEASED: "Not yet aired", CANCELLED: "Cancelled", HIATUS: "On hiatus" };

module.exports = {
    name: "anime",
    description: 'Looks up an anime on AniList.',
    aliases: [],
    options: [{ name: 'title', description: 'Anime title', type: ApplicationCommandOptionType.String, max_length: 100, required: true }],
    run: async (client, message, args) => {
        const search = args.join(" ").trim();
        if (!search) return message.reply("Which anime? Like `anime frieren`.");
        let a;
        try {
            a = (await http.getJson("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: QUERY, variables: { s: search } }) })).data?.Media;
        } catch {
            a = null;
        }
        if (!a) return message.reply(quiet(`I couldn't find an anime called "${truncate(search, 60)}".`));
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#7632A0")
            .setTitle(truncate(a.title.english || a.title.romaji, 256))
            .setURL(a.siteUrl)
            .setThumbnail(a.coverImage?.large ?? null)
            .setDescription(truncate(stripHtml(a.description), 600) || null)
            .addFields(
                { name: "Score", value: a.averageScore ? `${a.averageScore}/100` : "Not rated", inline: true },
                { name: "Episodes", value: String(a.episodes ?? "?"), inline: true },
                { name: "Status", value: STATUS[a.status] ?? "Unknown", inline: true },
                { name: "Genres", value: a.genres?.join(", ") || "None listed", inline: true },
                { name: "Year", value: String(a.seasonYear ?? "?"), inline: true },
            )
            .setFooter({ text: "From AniList" })] });
    }
};
