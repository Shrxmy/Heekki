const { greetCommand } = require("../../lib/greetings/command");
const { previewGreeting } = require("../../lib/greetings/post");

module.exports = greetCommand({
    name: "testjoin",
    description: 'Previews the join greeting here, using you as the member.',
    aliases: [],
    run: (client, message, args) => previewGreeting(message, "join"),
});
