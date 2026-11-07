const { Events } = require("discord.js");
const client = require("../index");
const { remember } = require("../fun/snipes");

client.on(Events.MessageDelete, (message) => remember("deleted", message));
