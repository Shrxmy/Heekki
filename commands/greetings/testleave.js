const { greetCommand } = require("../../greetings/command");
const { previewGreeting } = require("../../greetings/post");

module.exports = greetCommand({
    name: "testleave",
    description: 'Previews the leave greeting here, using you as the member.',
    aliases: [],
    run: (client, message, args) => previewGreeting(message, "leave"),
});
