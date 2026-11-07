const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, MessageFlags, ApplicationCommandOptionType } = require("discord.js");
const { getPrefix } = require("../../db");

// Each category is tinted with a LOONA member colour (named in the page footer).
const HOME = { color: "#7B3FBF", colorName: "Choerry purple" };
const CATEGORIES = {
    music: { label: "Music", blurb: "Play songs from YouTube and Spotify, with filters.", color: "#1F4FD8", colorName: "JinSoul blue" },
    fun: { label: "Fun & Games", blurb: "Games and small toys for the chat.", color: "#FFD700", colorName: "Hyunjin yellow" },
    greetings: { label: "Greetings", blurb: "Welcome and leave cards. Needs Manage Server.", color: "#FF0092", colorName: "Heejin pink" },
    utils: { label: "Utilities", blurb: "Bot settings and info.", color: "#C0C0C0", colorName: "Olivia Hye silver" },
};
const ORDER = Object.keys(CATEGORIES);

const capitalize = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();
const meta = (dir) => CATEGORIES[dir] ?? { label: capitalize(dir), blurb: "", color: HOME.color, colorName: HOME.colorName };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Category folders: known ones in a fixed order, then any others alphabetically. */
const directories = (commands) => {
    const dirs = [...new Set(commands.map((c) => c.directory))];
    return [...ORDER.filter((d) => dirs.includes(d)), ...dirs.filter((d) => !ORDER.includes(d)).sort()];
};
const inDir = (commands, dir) => commands.filter((c) => c.directory === dir).sort((a, b) => a.name.localeCompare(b.name));

/** "`-play <query>` or `/play query:`" (required <x>, optional [x]). */
function usage(cmd, prefix) {
    const opts = cmd.options ?? [];
    const prefixArgs = opts.map((o) => (o.type === ApplicationCommandOptionType.Attachment ? "(attach an image)" : o.required ? `<${o.name}>` : `[${o.name}]`));
    const slashArgs = opts.map((o) => (o.required ? `${o.name}:` : `[${o.name}:]`));
    return `\`${[`${prefix}${cmd.name}`, ...prefixArgs].join(" ")}\` or \`${[`/${cmd.name}`, ...slashArgs].join(" ")}\``;
}

function homeEmbed(commands, { prefix, botName, avatarURL }) {
    return new EmbedBuilder()
        .setColor(HOME.color)
        .setTitle(`${botName} · Help 🌙`)
        .setThumbnail(avatarURL ?? null)
        .setDescription([
            "Welcome to the Orbit. Pick a category from the menu below.",
            "",
            `Prefix in this server: \`${prefix}\`. Every command also works as a \`/\` slash command.`,
            `Details on one command: \`${prefix}help <command>\``,
        ].join("\n"))
        .addFields(directories(commands).map((dir) => ({
            name: meta(dir).label,
            value: [meta(dir).blurb, plural(inDir(commands, dir).length, "command")].filter(Boolean).join(" · "),
        })))
        .setFooter({ text: `Orbit colour: ${HOME.colorName}` });
}

function categoryEmbed(commands, dir, prefix) {
    const { label, blurb, color, colorName } = meta(dir);
    const list = inDir(commands, dir).map((c) => `\`${c.name}\` ${c.description}`).join("\n");
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(label)
        .setDescription([blurb, list].filter(Boolean).join("\n\n").slice(0, 4096))
        .setFooter({ text: `Orbit colour: ${colorName} · ${prefix}help <command> for details` });
}

/** The detail page for one command (by name or alias), or null if there's no such command. */
function commandEmbed(commands, query, prefix) {
    const q = query.toLowerCase();
    const cmd = commands.find((c) => c.name === q) ?? commands.find((c) => c.aliases?.includes(q));
    if (!cmd) return null;
    const { label, color, colorName } = meta(cmd.directory);
    const fields = [{ name: "Usage", value: usage(cmd, prefix) }];
    if (cmd.aliases?.length) fields.push({ name: "Aliases", value: cmd.aliases.map((a) => `\`${a}\``).join(", "), inline: true });
    fields.push({ name: "Category", value: label, inline: true });
    if (cmd.defaultMemberPermissions) fields.push({ name: "Who can use it", value: "Members with Manage Server", inline: true });
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(cmd.name)
        .setDescription(cmd.description)
        .addFields(fields)
        .setFooter({ text: `Orbit colour: ${colorName}` });
}

function menu(commands, disabled) {
    return [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("help-menu")
            .setPlaceholder("Choose a category")
            .setDisabled(disabled)
            .addOptions([
                { label: "Home", value: "home", description: "Back to the overview" },
                ...directories(commands).map((dir) => ({
                    label: meta(dir).label,
                    value: dir,
                    description: (meta(dir).blurb || plural(inDir(commands, dir).length, "command")).slice(0, 100),
                })),
            ]))];
}

module.exports = {
    name: "help",
    description: 'Shows what the bot can do, or details on one command.',
    aliases: ['h'],
    options: [{ name: 'command', description: 'A command to explain (leave empty for the overview)', type: ApplicationCommandOptionType.String }],
    usage, homeEmbed, categoryEmbed, commandEmbed, menu,
    run: async (client, message, args) => {
        const commands = [...client.commands.values()];
        const prefix = getPrefix(message.guild.id);

        if (args.length) {
            const embed = commandEmbed(commands, args[0], prefix);
            if (!embed) return message.reply(`I don't have a command called \`${args[0].slice(0, 32)}\`. Try \`${prefix}help\` for the list.`);
            return message.reply({ embeds: [embed] });
        }

        const home = homeEmbed(commands, { prefix, botName: client.user.username, avatarURL: client.user.displayAvatarURL() });
        const page = await message.reply({ embeds: [home], components: menu(commands, false) });

        // Other people get a private note instead of a silent "interaction failed".
        const filter = (i) => {
            if (i.user.id === message.author.id) return true;
            i.reply({ content: `Run \`${prefix}help\` yourself to browse the commands.`, flags: MessageFlags.Ephemeral }).catch(() => {});
            return false;
        };
        const collector = page.createMessageComponentCollector({ filter, componentType: ComponentType.StringSelect, idle: 120_000 });

        collector.on("collect", (i) => {
            const [choice] = i.values;
            const embed = choice === "home" ? home : categoryEmbed(commands, choice, prefix);
            i.update({ embeds: [embed] }).catch(console.error);
        });
        collector.on("end", () => {
            page.edit({ components: menu(commands, true) }).catch(() => {});
        });
    },
};
