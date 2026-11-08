const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const http = require("../../lib/info/http");
const { truncate } = require("../../lib/info/format");
const { quiet } = require("../../lib/fun/target");

// WMO weather codes used by Open-Meteo.
const SKY = { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Rain showers", 81: "Rain showers", 82: "Violent rain showers",
    85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail" };
const both = (c) => `${c}°C / ${Math.round(c * 9 / 5 + 32)}°F`;

module.exports = {
    name: "weather",
    description: 'Current weather for a city (Open-Meteo).',
    aliases: [],
    options: [{ name: 'place', description: 'City or town', type: ApplicationCommandOptionType.String, max_length: 80, required: true }],
    run: async (client, message, args) => {
        const place = args.join(" ").trim();
        if (!place) return message.reply("Which place? Like `weather Seoul`.");
        let spot, now;
        try {
            spot = (await http.getJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(place)}`)).results?.[0];
            if (!spot) return message.reply(quiet(`I couldn't find a place called "${truncate(place, 60)}".`));
            const q = `latitude=${spot.latitude}&longitude=${spot.longitude}&timezone=auto&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m`;
            now = (await http.getJson(`https://api.open-meteo.com/v1/forecast?${q}`)).current;
        } catch {
            return message.reply("The weather service didn't answer, try again in a bit.");
        }
        return message.reply({ embeds: [new EmbedBuilder()
            .setColor("#1313D6")
            .setTitle(`${spot.name}, ${spot.country}`)
            .setDescription(SKY[now.weather_code] ?? "Unknown conditions")
            .addFields(
                { name: "Temperature", value: both(now.temperature_2m), inline: true },
                { name: "Feels like", value: both(now.apparent_temperature), inline: true },
                { name: "Humidity", value: `${now.relative_humidity_2m}%`, inline: true },
                { name: "Wind", value: `${now.wind_speed_10m} km/h`, inline: true },
            )
            .setFooter({ text: `Local time ${now.time.replace("T", " ")} · Open-Meteo` })] });
    }
};
