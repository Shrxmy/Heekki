// One place for outside web requests: a clear user agent, a timeout, and a size cap.
const MAX_BYTES = 2 * 1024 * 1024;
const HEADERS = { "User-Agent": "Heekki Discord bot (self-hosted)", Accept: "application/json, application/rss+xml, */*" };

async function getBuffer(url, { timeoutMs = 8000, ...init } = {}) {
    const res = await fetch(url, { ...init, headers: { ...HEADERS, ...init.headers }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const chunks = [];
    let total = 0;
    for await (const chunk of res.body) {
        total += chunk.length;
        if (total > MAX_BYTES) throw new Error("Response too large");
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

const getText = async (url, init) => (await getBuffer(url, init)).toString("utf8");
const getJson = async (url, init) => JSON.parse(await getText(url, init));

module.exports = { getBuffer, getText, getJson, MAX_BYTES };
