const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const http = require("../../lib/info/http");
const { stripHtml, truncate } = require("../../lib/info/format");
const { quiet } = require("../../lib/fun/target");

const price = (d) => {
    if (d.is_free) return "Free";
    const p = d.price_overview;
    if (!p) return "Not for sale";
    return p.discount_percent ? `~~${p.initial_formatted}~~ **${p.final_formatted}** (-${p.discount_percent}%)` : p.final_formatted;
};

module.exports = {
    name: "steam",
    description: 'Looks up a game on the Steam store.',
    aliases: [],
    options: [{ name: 'game', description: 'Game name', type: ApplicationCommandOptionType.String, max_length: 100, required: true }],
    run: async (client, message, args) => {
        const game = args.join(" ").trim();
        if (!game) return message.reply("Which game? Like `steam stardew valley`.");
        let d, id;
        try {
            id = (await http.getJson(`https://store.steampowered.com/api/storesearch/?l=english&cc=US&term=${encodeURIComponent(game)}`)).items?.[0]?.id;
            if (id) d = (await http.getJson(`https://store.steampowered.com/api/appdetails?l=english&cc=US&appids=${Number(id)}`))[id]?.data;
        } catch {
            return message.reply("Steam didn't answer, try again in a bit.");
        }
        if (!d) return message.reply(quiet(`I couldn't find "${truncate(game, 60)}" on Steam.`));
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#1313D6")
            .setTitle(truncate(d.name, 256))
            .setURL(`https://store.steampowered.com/app/${Number(id)}`)
            .setDescription(truncate(stripHtml(d.short_description), 500) || null)
            .setImage(d.header_image ?? null)
            .addFields(
                { name: "Price", value: price(d), inline: true },
                { name: "Released", value: d.release_date?.date || "?", inline: true },
                { name: "Genres", value: d.genres?.map((g) => g.description).join(", ") || "None listed", inline: true },
            )] });
    }
};
