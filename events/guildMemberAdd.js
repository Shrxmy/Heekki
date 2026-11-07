const { Events } = require("discord.js");
const client = require("../index");
const { sendGreeting } = require("../greetings/post");

client.on(Events.GuildMemberAdd, (member) => sendGreeting(member, "join"));
