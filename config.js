// All bot settings in one place. Secrets come from .env (loaded by `npm start`), never from this file.

exports.TOKEN = process.env.DISCORD_TOKEN || '';

exports.PREFIX = '-';

// The Lavalink music server started by docker-compose.yml; it reads the same LAVALINK_PASSWORD from .env.
exports.LAVALINK = {
    host: process.env.LAVALINK_HOST || 'localhost',
    port: Number(process.env.LAVALINK_PORT) || 2333,
    password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
};
