const { Collection, ApplicationCommandOptionType } = require("discord.js");

const isAttachment = (option) => option.type === ApplicationCommandOptionType.Attachment;

/**
 * Wraps a slash command so the message-style commands can run unchanged:
 * the first reply/send fills in the deferred "thinking..." response, later ones become follow-ups.
 * Both return the sent Message, so button/menu collectors work the same as with prefix commands.
 */
function asMessage(interaction) {
    let responded = false;
    const respond = (payload) => {
        const options = typeof payload === "string" ? { content: payload } : payload;
        const sent = responded ? interaction.followUp(options) : interaction.editReply(options);
        responded = true;
        return sent;
    };
    return {
        guild: interaction.guild,
        member: interaction.member,
        author: interaction.user,
        channel: {
            id: interaction.channelId,
            send: respond,
            awaitMessages: (options) => interaction.channel.awaitMessages(options),
        },
        reply: respond,
        // Uploaded files, shaped like a real Message's attachments.
        attachments: new Collection(interaction.options.data.filter(isAttachment).map((o) => [o.attachment.id, o.attachment])),
    };
}

// Slash option values as prefix-style string args, in the order the command declares its options
// (options the user left empty are skipped; attachments go to message.attachments instead; a user option gives the user's ID).
const toArgs = (interaction, declaredOptions = []) => declaredOptions
    .filter((declared) => !isAttachment(declared))
    .map((declared) => interaction.options.data.find((o) => o.name === declared.name))
    .filter((option) => option !== undefined)
    .map((option) => String(option.value));

module.exports = { asMessage, toArgs };
