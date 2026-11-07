const { Events } = require("discord.js");
const client = require("../index");
const { remember } = require("../fun/snipes");

// Only real text edits (Discord also "updates" a message when it adds a link preview).
client.on(Events.MessageUpdate, (before, after) => {
    if (before.content !== after.content) remember("edited", before);
});
