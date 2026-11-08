const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType,
    MessageFlags, ApplicationCommandOptionType } = require("discord.js");
const loona = require("../../lib/loona");
const { quiet } = require("../../lib/fun/target");

const WIKI = "LOONA Wiki";
const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });


function groupEmbed(now = new Date()) {
    const { group, members, nextBirthdays, age } = loona;
    const [next] = nextBirthdays(now);
    const turning = age(next.member, now) + (next.days === 0 ? 0 : 1);
    return new EmbedBuilder()
        .setColor(members[7].color.hex) // Choerry purple
        .setTitle(`${group.name} (${group.korean})`)
        .setDescription(`${group.about}\n\nPick a member below, or use \`loona <name>\`.`)
        .addFields(
            { name: "Debut", value: longDate(group.debut), inline: true },
            { name: "Fandom", value: group.fandom, inline: true },
            { name: "Sub-units", value: group.subunits.join(", "), inline: true },
            { name: "Members", value: members.map((m) => `${m.animal.split(" ")[0]} ${m.name}`).join(" · ") },
            { name: "Next birthday", value: next.days === 0
                ? `It's **${next.member.name}**'s birthday today! She turns ${turning}.`
                : `**${next.member.name}** turns ${turning} in ${next.days} day${next.days === 1 ? "" : "s"} (${longDate(next.member.birthday).replace(/, \d{4}$/, "")}).` },
        )
        .setImage(group.photo.url)
        .setFooter({ text: `${loona.photoCredit({ source: "commons", ...group.photo })} · Info: ${WIKI} (CC BY-SA)` });
}

function memberEmbed(member, { photo = 0, fact = 0, now = new Date() } = {}) {
    const photos = member.photos;
    const shown = photos[photo % photos.length];
    const birthdayToday = loona.daysUntilBirthday(member, now) === 0;
    return new EmbedBuilder()
        .setColor(member.color.hex)
        .setAuthor({ name: `LOONA · Member #${member.order}` })
        .setTitle(`${member.name} (${member.korean})`)
        .setDescription(`${member.animal} · ${member.color.name} · ${member.shape}\n\n**Did you know?** ${member.facts[fact % member.facts.length]}`)
        .addFields(
            { name: "Birth name", value: member.birthName, inline: true },
            { name: "Birthday", value: `${longDate(member.birthday)} (${loona.age(member, now)})${birthdayToday ? "\n🎂 It's her birthday today!" : ""}`, inline: true },
            { name: "Birthplace", value: member.birthplace, inline: true },
            { name: "Revealed", value: longDate(member.revealed), inline: true },
            { name: "Solo single", value: member.single, inline: true },
            { name: "Flower", value: member.flower, inline: true },
            { name: "Position", value: member.position },
            { name: "Now", value: [member.now, member.agency].filter(Boolean).join(" · ") },
            { name: "Nickname", value: member.nickname, inline: true },
        )
        .setImage(shown.url)
        .setFooter({ text: `${loona.photoCredit(shown)} (${(photo % photos.length) + 1}/${photos.length}) · Info: ${WIKI} (CC BY-SA)` });
}

const memberButtons = (member, photo) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("loona-prev").setLabel("Previous").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("loona-fact").setLabel("Another fact").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("loona-photo").setLabel(`Next photo (${(photo % member.photos.length) + 1}/${member.photos.length})`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("loona-next").setLabel("Next").setStyle(ButtonStyle.Secondary),
);

const memberMenu = () => new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId("loona-pick")
    .setPlaceholder("Choose a member")
    .addOptions(loona.members.map((m) => ({ label: `${m.name} (${m.korean})`, value: m.key, description: `${m.color.name} · ${m.animal.replace(/^\S+\s/, "")}` }))));

/** Next view after a button press. `state` = { member: index, photo, fact }. */
function step(state, button) {
    const count = loona.members.length;
    const member = loona.members[state.member];
    switch (button) {
        case "loona-next": return { member: (state.member + 1) % count, photo: 0, fact: 0 };
        case "loona-prev": return { member: (state.member - 1 + count) % count, photo: 0, fact: 0 };
        case "loona-photo": return { ...state, photo: (state.photo + 1) % member.photos.length };
        case "loona-fact": return { ...state, fact: (state.fact + 1) % member.facts.length };
        default: return state;
    }
}

module.exports = {
    name: "loona",
    description: 'LOONA member profiles with photos and fun facts.',
    aliases: ['orbit', 'member'],
    options: [{ name: 'member', description: 'Leave empty for the group page', type: ApplicationCommandOptionType.String,
        choices: loona.members.map((m) => ({ name: m.name, value: m.key })) }],
    groupEmbed, memberEmbed, memberButtons, memberMenu, step,
    run: async (client, message, args) => {
        const query = args.join(" ");
        const found = query ? loona.findMember(query) : null;
        if (query && !found) return message.reply(quiet(`I don't know a LOONA member called "${query.slice(0, 40)}". Try \`loona\` for the list.`));

        let state = found ? { member: found.order - 1, photo: 0, fact: Math.floor(Math.random() * found.facts.length) } : null;
        const view = () => (state
            ? { embeds: [memberEmbed(loona.members[state.member], state)], components: [memberButtons(loona.members[state.member], state.photo), memberMenu()] }
            : { embeds: [groupEmbed()], components: [memberMenu()] });

        const page = await message.reply(view());
        const filter = (i) => {
            if (i.user.id === message.author.id) return true;
            i.reply({ content: "Run `loona` yourself to browse the members.", flags: MessageFlags.Ephemeral }).catch(() => {});
            return false;
        };
        const collector = page.createMessageComponentCollector({ filter, idle: 120_000 });
        // Clicks are handled one at a time, so a slow update can't overwrite a newer page.
        let queue = Promise.resolve();
        collector.on("collect", (i) => {
            queue = queue.then(async () => {
                if (i.componentType === ComponentType.StringSelect) {
                    const picked = loona.findMember(i.values[0]);
                    state = { member: picked.order - 1, photo: 0, fact: Math.floor(Math.random() * picked.facts.length) };
                } else {
                    state = step(state, i.customId);
                }
                await i.update(view());
            }).catch(console.error);
        });
        collector.on("end", () => page.edit({ components: [] }).catch(() => {}));
    },
};
