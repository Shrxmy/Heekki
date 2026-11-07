const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");

const SOURCES = { kpop: "kpopmemes", loona: "LOONA" };
const IMAGE_HOSTS = new Set(["i.redd.it", "i.imgur.com"]);
const IMAGE_FILE = /\.(?:png|jpe?g|gif|webp)$/i; // ".gifv" etc. are video pages, not images

/** The post's image URL if it's an https image file on an allowed host, else null. */
function imageUrl(url) {
    try {
        const u = new URL(url);
        return u.protocol === "https:" && IMAGE_HOSTS.has(u.hostname) && IMAGE_FILE.test(u.pathname) ? u.href : null;
    } catch {
        return null;
    }
}

/** A safe-for-work image post from meme-api.com, or null (tries a few times to skip NSFW/spoilers/non-images). */
async function fetchMeme(subreddit, fetchImpl = fetch) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const post = await fetchImpl(`https://meme-api.com/gimme/${subreddit}`, { signal: AbortSignal.timeout(5000) })
            .then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (!post?.url) return null;
        if (post.nsfw === false && !post.spoiler && imageUrl(post.url)) return post;
    }
    return null;
}

/** The meme service's fields are outside data: coerce and cap them so the embed is always valid. */
function memeEmbed(post) {
    const link = typeof post.postLink === "string" && /^https:\/\/(?:www\.)?(?:reddit\.com|redd\.it)\//.test(post.postLink) ? post.postLink : null;
    const ups = Number.isFinite(Number(post.ups)) ? Math.trunc(Number(post.ups)) : 0;
    return new EmbedBuilder()
        .setColor("#FF0092")
        .setTitle(String(post.title ?? "Meme").slice(0, 256) || "Meme")
        .setURL(link)
        .setImage(imageUrl(post.url))
        .setFooter({ text: `r/${String(post.subreddit ?? "").slice(0, 40)} · ${ups} upvotes` });
}

module.exports = {
    name: "meme",
    description: 'A random meme from r/kpopmemes or r/LOONA.',
    aliases: [],
    options: [{ name: 'source', description: 'Where to get it from', type: ApplicationCommandOptionType.String,
        choices: [{ name: 'K-pop memes', value: 'kpop' }, { name: 'r/LOONA', value: 'loona' }] }],
    fetchMeme, memeEmbed,
    run: async (client, message, args) => {
        const subreddit = SOURCES[args[0]?.toLowerCase()] ?? SOURCES.kpop;
        const post = await fetchMeme(subreddit);
        if (!post) return message.reply("I couldn't get a meme right now, try again in a bit.");
        return message.reply({ embeds: [memeEmbed(post)] });
    }
};
