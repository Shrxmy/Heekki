// Points each non-LOONA card at an official concept photo from the K-pop Wiki (kpop.fandom.com), one era per rarity,
// oldest era for common through newest for moon. Rewrites lib/cards/<group>.json.
// Fandom's image server turns scripts away, so fetch the chosen photos in a browser tab on kpop.fandom.com into a
// { "<card id>": "<base64>" } JSON file, then:  node --env-file=.env scripts/upload-photocard-scans.js --bundle <file>
// Usage: node scripts/fandom-concept-photos.js <group ...>   (pin a member's page in PAGES if the guess is wrong)
const fs = require("node:fs");
const path = require("node:path");

const API = "https://kpop.fandom.com/api.php";
const UA = "Heekki/2.0 ( https://github.com/Shrxmy/Heekki )";
const RARITIES = ["common", "rare", "super", "moon"];
// Members whose gallery title isn't "<name> (<group>)/Gallery" or "<name>/Gallery".
const PAGES = { "txt.hueningkai": "Hueningkai/Gallery" };
// Promo shots that aren't concept photos: tour posters, fan events, merch, gifs.
// Pre-debut: SIXTEEN is the survival show TWICE came from, SMROOKIES is SM's trainee team.
const SKIP = /\.gif$|poster|season'?s greeting|fan ?meet|fanmeeting|channel|tour|profile|concert|photobook|membership|anniversary|birthday|\blogo\b|\bSIXTEEN\b|SMROOKIES/i;
// Rejected after looking at them: duo shots with other artists, collages, and photos where the person is tiny
// (SEVENTEEN's 17 Carat set is full-body on white).
const REJECT = new Set([
    "Jihyo_&_Shenseea_Distant_Lover_concept_photo.png", "Bang_Ye_Dam_X_Winter_Officially_Cool_concept_photo_1.png",
    "V8_Vernon_V8_concept_photo_1.png", "SHINee_Jonghyun_2009,_Year_of_Us_concept_photo_1.png",
    "SHINee_Onew_Atlantis_teaser_photo_1.png", "Minho_Make_It_Hot_concept_photo_1.png",
    "Taemin_Phase_1_-_Soft_Violence_concept_photo_9.png", "Nayeon_Na-sty_concept_photo_3.png",
]);
const MIN_WIDTH = 600; // the upload script shrinks to 600px wide
const PORTRAIT = 0.85; // width / height: the card is 0.65, so wider photos lose too much to the crop

async function api(params) {
    const res = await fetch(`${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Fandom API returned ${res.status}`);
    return res.json();
}

async function galleryPage(group, member) {
    if (PAGES[member.key]) return PAGES[member.key];
    const titles = [`${member.name} (${group.short})/Gallery`, `${member.name} (${group.name})/Gallery`, `${member.name}/Gallery`];
    const { query } = await api({ action: "query", titles: titles.join("|"), redirects: "1" });
    // Prefer the group-qualified title: a bare "<name>/Gallery" can belong to someone else.
    for (const t of titles) {
        const resolved = query.redirects?.find((r) => r.from === t)?.to ?? t;
        if (query.pages.some((p) => p.title === resolved && !p.missing)) return resolved;
    }
    throw new Error(`no gallery page for ${member.name}`);
}

/** A gallery caption as plain text: "''[[Feel Special]]'' (2)" -> "Feel Special". */
function eraName(caption) {
    let s = caption.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1");
    while (/\{\{[^{}]*\}\}/.test(s)) s = s.replace(/\{\{[^{}]*\}\}/g, ""); // templates can be nested
    return s.replace(/[{}]/g, "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/'''/g, "'").replace(/''|"/g, "")
        .replace(/\(\d+\)/g, "").replace(/\s+/g, " ").trim();
}

/** The Promotional gallery as [{ file, era }], oldest first, without "(2)"-style numbering in the era. */
async function promoPhotos(page) {
    const { parse } = await api({ action: "parse", page, prop: "wikitext" });
    const text = parse.wikitext.split(/^==\s*Promotional\s*==\s*$/m)[1]?.split(/^==[^=]/m)[0] ?? "";
    return text.split("\n").map((line) => line.match(/^(?:File:)?([^|<>[\]]+\.(?:png|jpe?g|webp|gif))\s*\|(.*)$/i)).filter(Boolean)
        .map(([, file, caption]) => ({ file: file.trim(), era: eraName(caption) }))
        .filter((p) => p.era && !SKIP.test(p.file) && !SKIP.test(p.era) && !/[ _]17[ _]Carat[ _]/.test(p.file)
            && !REJECT.has(p.file.replace(/ /g, "_")));
}

async function imageInfo(files) {
    const info = new Map();
    for (let i = 0; i < files.length; i += 50) {
        const { query } = await api({ action: "query", titles: files.slice(i, i + 50).map((f) => `File:${f}`).join("|"),
            prop: "imageinfo", iiprop: "url|size", iiurlwidth: "900" }); // thumburl: 900px wide is plenty for a 600px card
        const norm = new Map((query.normalized ?? []).map((n) => [n.to, n.from]));
        for (const p of query.pages) if (p.imageinfo) info.set((norm.get(p.title) ?? p.title).replace(/^File:/, ""), p.imageinfo[0]);
    }
    return info;
}

/** Four photos from four different eras, spread from oldest to newest; portrait photos when an era has one. */
function pickFour(photos, info) {
    const eras = new Map();
    for (const p of photos) {
        const ii = info.get(p.file);
        if (!ii || ii.width < MIN_WIDTH) continue;
        const portrait = ii.width / ii.height <= PORTRAIT;
        const best = eras.get(p.era);
        if (!best || (portrait && !best.portrait)) eras.set(p.era, { ...p, ...ii, portrait });
    }
    const list = [...eras.values()];
    const pool = list.filter((p) => p.portrait).length >= 4 ? list.filter((p) => p.portrait) : list;
    if (pool.length < 4) throw new Error(`only ${pool.length} usable eras`);
    return RARITIES.map((_, i) => pool[Math.round((i * (pool.length - 1)) / 3)]);
}

(async () => {
    const groups = process.argv.slice(2);
    if (!groups.length) throw new Error("name the groups, e.g. twice aespa");
    let failed = 0;
    for (const key of groups) {
        const file = path.join(__dirname, "..", "lib", "cards", `${key}.json`);
        const group = JSON.parse(fs.readFileSync(file, "utf8"));
        for (const member of group.members) {
            try {
                const page = await galleryPage(group, member);
                const photos = await promoPhotos(page);
                const picks = pickFour(photos, await imageInfo(photos.map((p) => p.file)));
                picks.forEach((p, i) => {
                    group.cards[`${member.key}-${RARITIES[i]}`] = {
                        url: p.thumburl ?? p.url,
                        page: p.descriptionurl,
                        from: p.era,
                        credit: "Official photo via K-pop Wiki (kpop.fandom.com)",
                    };
                });
                console.log(`ok   ${member.key}: ${picks.map((p) => `${p.era}${p.portrait ? "" : " [wide]"}`).join(" · ")}`);
            } catch (err) {
                failed++;
                console.error(`FAIL ${member.key}: ${err.message} (kept its current cards)`);
            }
        }
        group.source = "Members: Wikidata (CC0). Photos: official concept photos via the K-pop Wiki (kpop.fandom.com), chosen by scripts/fandom-concept-photos.js; re-run that script to swap them, then upload with scripts/upload-photocard-scans.js --bundle (Fandom only serves images to browsers).";
        fs.writeFileSync(file, `${JSON.stringify(group, null, 1)}\n`);
    }
    process.exitCode = failed ? 1 : 0;
})().catch((err) => { console.error(err.message); process.exitCode = 1; });
