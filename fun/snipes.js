// The last deleted / edited message per channel, kept in memory only and forgotten after 15 minutes.
const KEEP_MS = 15 * 60_000;
const store = new Map(); // `${kind}:${channelId}` -> snipe

// Expired snipes are deleted (not just hidden), so old message text never lingers in memory.
function dropExpired(now = Date.now()) {
    for (const [key, snipe] of store) if (now - snipe.at > KEEP_MS) store.delete(key);
}

/** @param {"deleted"|"edited"} kind @param message the message as it was before deletion / editing */
function remember(kind, message) {
    dropExpired();
    if (!message?.content || message.author?.bot) return;
    store.set(`${kind}:${message.channelId}`, {
        content: message.content,
        authorTag: message.author.tag,
        authorAvatar: message.author.displayAvatarURL(),
        at: Date.now(),
    });
}

function recall(kind, channelId) {
    const key = `${kind}:${channelId}`;
    const snipe = store.get(key);
    if (!snipe) return null;
    if (Date.now() - snipe.at > KEEP_MS) {
        store.delete(key);
        return null;
    }
    return snipe;
}

const count = () => store.size;

module.exports = { remember, recall, count, KEEP_MS };
