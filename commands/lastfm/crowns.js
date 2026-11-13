const { ApplicationCommandOptionType } = require("discord.js");
const lastfm = require("../../lib/lastfm");
const { crownsOf } = require("../../lib/db");
const { targetMember } = require("../../lib/fun/target");
const { memberFor } = require("../../lib/loona");
const { musicEmbed, emoji } = require("../../lib/music/embed");

const SHOWN = 15;

module.exports = {
    name: "crowns",
    description: "The artist crowns someone holds in this server (win them with whoknows).",
    aliases: ['cw'],
    options: [{ name: 'user', description: 'Who (leave empty for yourself)', type: ApplicationCommandOptionType.User }],
    run: async (client, message, args) => {
        const member = await targetMember(message, args[0]);
        if (!member) return message.reply("I couldn't find that member 🌙");
        const crowns = await crownsOf(message.guild.id, member.id);
        const self = member.id === message.author.id;
        if (!crowns.length) {
            return message.reply(lastfm.quiet(self
                ? "You don't have any crowns yet, Orbit. Use `whoknows <artist>` on an artist you love to claim one 👑"
                : `**${lastfm.clean(member.displayName)}** doesn't have any crowns yet 👑`));
        }
        const host = memberFor(member.id);
        const rows = crowns.slice(0, SHOWN).map((c, i) => `\`${i + 1}.\` **${lastfm.clean(c.artist)}** · ${lastfm.plural(c.plays, "play")}`);
        const embed = musicEmbed(host)
            .setAuthor({ name: `${emoji(host)} ${member.displayName}'s crowns in ${message.guild.name}`.slice(0, 256), iconURL: member.displayAvatarURL?.() ?? undefined })
            .setDescription(rows.join("\n") + (crowns.length > SHOWN ? `\n…and ${crowns.length - SHOWN} more` : ""))
            .setFooter({ text: `👑 ${lastfm.plural(crowns.length, "crown")} · counted when someone runs whoknows or artist` });
        return message.reply({ embeds: [embed] });
    }
};
