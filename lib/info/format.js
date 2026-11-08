// Small formatting helpers for the Info commands.

/** 90061000 → "1d 1h 1m 1s" (zero parts left out). */
function duration(ms) {
    const s = Math.floor(ms / 1000);
    const parts = [[Math.floor(s / 86400), "d"], [Math.floor(s / 3600) % 24, "h"], [Math.floor(s / 60) % 60, "m"], [s % 60, "s"]];
    return parts.filter(([n]) => n).map(([n, u]) => `${n}${u}`).join(" ") || "0s";
}

/** Discord renders this in each viewer's own timezone: "Nov 8, 2026 (2 days ago)". */
const stamp = (date) => { const t = Math.floor(new Date(date).getTime() / 1000); return `<t:${t}:D> (<t:${t}:R>)`; };

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodeEntities = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m);

const stripHtml = (s) => decodeEntities(String(s ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim();

const truncate = (s, max) => { const text = String(s ?? ""); return text.length > max ? text.slice(0, max - 1) + "…" : text; };

module.exports = { duration, stamp, stripHtml, decodeEntities, truncate };
