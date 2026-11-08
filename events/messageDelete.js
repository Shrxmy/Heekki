const { Events } = require("discord.js");
const client = require("../index");
const { remember } = require("../lib/fun/snipes");

client.on(Events.MessageDelete, (message) => remember("deleted", message));
