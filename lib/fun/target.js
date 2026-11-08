// Shared bits for the Fun commands.

/** The member named in args[0] (mention or ID), or the person who ran the command. Null if a given member isn't found. */
async function targetMember(message, arg) {
    if (!arg) return message.member;
    const id = arg.match(/\d{17,20}/)?.[0];
    return (id && await message.guild.members.fetch(id).catch(() => null)) || null;
}

// For commands that echo user text: it must never ping anyone.
const quiet = (content) => ({ content, allowedMentions: { parse: [], repliedUser: true } });

module.exports = { targetMember, quiet };
