const loona = require("../../lib/loona");
const db = require("../../lib/db");

const BASE = 150, PER_DAY = 20, MAX_STREAK = 7;
const iso = ({ y, m, d }) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** Today and yesterday in Korea time, as "YYYY-MM-DD". */
const days = (now = new Date()) => ({ today: iso(loona.koreaDate(now)), yesterday: iso(loona.koreaDate(new Date(now.getTime() - 86_400_000))) });

module.exports = {
    name: "daily",
    description: `Daily moon coins: ${BASE}, plus ${PER_DAY} for each day in a row (up to ${MAX_STREAK} days). Resets at midnight KST.`,
    aliases: ["dailies"],
    days,
    BASE, PER_DAY, MAX_STREAK,
    run: async (client, message, args) => {
        const { today, yesterday } = days();
        const got = await db.claimDaily(message.guild.id, message.author.id, today, yesterday, BASE, PER_DAY, MAX_STREAK);
        if (!got) return message.reply("You've had today's daily already. It comes back at midnight Korea time 🌙");
        const streak = got.streak > 1 ? ` · 🔥 ${got.streak} days in a row${got.streak === MAX_STREAK ? " (max!)" : ""}` : "";
        return message.reply(`🌙 **+${got.coins}** moon coins${streak}. Balance **${got.balance}**. Come back tomorrow to keep the streak going.`);
    },
};
