const { Events } = require("discord.js");
const client = require("../index");
const { startBirthdayPosts } = require("../lib/loona/birthdays");

client.on(Events.ClientReady, () => {
    console.log(`${client.user.tag} is up and ready to go!`);
    startBirthdayPosts(client);
});
