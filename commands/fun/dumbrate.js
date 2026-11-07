const { rateCommand } = require("../../fun/rate");

module.exports = rateCommand({ kind: "dumb", adjective: "dumb", aliases: ['dumb'],
    lines: [[90, "Lost in orbit."], [60, "Running on vibes."], [30, "Only a little scattered."], [0, "Sharp as ever."]] });
