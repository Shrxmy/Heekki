// LOONA member data (snapshot in members.json; see its "source" field for credits) and small helpers.
const data = require("./members.json");

const { group, members, source } = data;

// "Kim-Lip", "kim lip" and "KIMLIP" all become "kimlip"; Korean letters are kept.
const normalize = (text) => String(text).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const index = new Map(members.flatMap((m) => [m.name, m.korean, m.key, ...m.aliases].map((alias) => [normalize(alias), m])));

/** The member called `query` (name, Korean name, nickname...), or null. */
const findMember = (query) => (normalize(query ?? "") && index.get(normalize(query))) || null;

// Birthdays are counted in Korea time, which is when fans celebrate them.
function koreaDate(now) {
    const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now).split("-").map(Number);
    return { y, m, d };
}
const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; };

function age(member, now = new Date()) {
    const today = koreaDate(now), born = parse(member.birthday);
    const hadBirthday = today.m > born.m || (today.m === born.m && today.d >= born.d);
    return today.y - born.y - (hadBirthday ? 0 : 1);
}

function daysUntilBirthday(member, now = new Date()) {
    const today = koreaDate(now), born = parse(member.birthday);
    const start = Date.UTC(today.y, today.m - 1, today.d);
    let next = Date.UTC(today.y, born.m - 1, born.d);
    if (next < start) next = Date.UTC(today.y + 1, born.m - 1, born.d);
    return Math.round((next - start) / 86_400_000);
}

/** Every member with the days left until her birthday, soonest first. */
const nextBirthdays = (now = new Date()) => members
    .map((member) => ({ member, days: daysUntilBirthday(member, now) }))
    .sort((a, b) => a.days - b.days || a.member.order - b.member.order);

/** A member picked from some text: the same text always gets the same member. */
function memberFor(text) {
    let hash = 0;
    for (const ch of String(text)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
    return members[hash % members.length];
}

// Every photo is freely licensed from Wikimedia Commons. (The LOONA Wiki's image server refuses Discord, so its photos can't be used.)
const photoCredit = (photo) => `Photo: ${photo.artist}, ${photo.license}, via Wikimedia Commons`;

module.exports = { group, members, source, findMember, memberFor, koreaDate, age, daysUntilBirthday, nextBirthdays, photoCredit };
