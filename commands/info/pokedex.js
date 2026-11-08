const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const http = require("../../lib/info/http");
const { truncate } = require("../../lib/info/format");

const title = (s) => s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

module.exports = {
    name: "pokedex",
    description: 'Looks up a Pokémon by name or number.',
    aliases: ['pokemon', 'dex'],
    options: [{ name: 'pokemon', description: 'Name or Pokédex number', type: ApplicationCommandOptionType.String, max_length: 30, required: true }],
    run: async (client, message, args) => {
        // "Mr. Mime" → "mr-mime"; anything else unusual can't reach the URL.
        const name = args.join(" ").toLowerCase().replace(/[.'’]/g, "").trim().replace(/\s+/g, "-");
        if (!/^[a-z0-9-]{1,30}$/.test(name)) return message.reply("Give me a Pokémon name or number, like `pokedex eevee`.");
        let p, species;
        try {
            p = await http.getJson(`https://pokeapi.co/api/v2/pokemon/${name}`);
            // The species link comes from PokeAPI's response; only follow it if it really points back at PokeAPI.
            const speciesUrl = String(p.species?.url ?? "");
            species = speciesUrl.startsWith("https://pokeapi.co/api/v2/pokemon-species/") ? await http.getJson(speciesUrl).catch(() => null) : null;
        } catch {
            return message.reply("I couldn't find that Pokémon.");
        }
        const flavor = species?.flavor_text_entries?.find((f) => f.language.name === "en")?.flavor_text.replace(/[\f\n\s]+/g, " ");
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#FFCB07")
            .setTitle(`#${p.id} ${title(p.name)}`)
            .setDescription(truncate(flavor ?? "", 300) || null)
            .setThumbnail(p.sprites?.other?.["official-artwork"]?.front_default ?? null)
            .addFields(
                { name: "Type", value: p.types.map((t) => title(t.type.name)).join(" / "), inline: true },
                { name: "Height", value: `${p.height / 10} m`, inline: true },
                { name: "Weight", value: `${p.weight / 10} kg`, inline: true },
                { name: "Abilities", value: p.abilities.map((a) => title(a.ability.name)).join(", ") },
                { name: "Base stats", value: p.stats.map((s) => `${title(s.stat.name)} ${s.base_stat}`).join(" · ") },
            )] });
    }
};
