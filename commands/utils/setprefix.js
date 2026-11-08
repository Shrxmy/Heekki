const { PermissionFlagsBits, ApplicationCommandOptionType } = require("discord.js");
const { getCustomPrefix, setPrefix } = require("../../lib/db");

module.exports = {
    name: "setprefix",
    description: 'Sets a specific prefix for your server.',
    aliases: ['sp'],
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild.toString(), // hides /setprefix from members who can't use it
    options: [{ name: 'prefix', description: 'The new prefix (leave empty to see the current one)', type: ApplicationCommandOptionType.String, max_length: 10 }],
    run: async (client, message, args) => {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.channel.send("**You Do Not Have Sufficient Permissions! - [MANAGE_GUILD]**")

        if (!args[0]) {
          let b = getCustomPrefix(message.guild.id);
          if (b) {
        return message.channel.send(
          `**Prefix Of This Server is \`${b}\`**`
        );
      } else return message.channel.send("**Please Enter A Prefix To Set!**");
    } 
      
        let a = args.join(' ');
        if (a.length > 10) return message.channel.send('**The prefix can be at most 10 characters long!**')
        let b = getCustomPrefix(message.guild.id)

        if (a === b) {
            return message.channel.send('**This is Already The Server Prefix!**')
        } else {
            setPrefix(message.guild.id, a)

            return message.channel.send(`**Successfuly Set Server Prefix To \`${a}\`**`)
        }
    }
}
