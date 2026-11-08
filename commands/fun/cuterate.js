const { rateCommand } = require("../../lib/fun/rate");

module.exports = rateCommand({ kind: "cute", adjective: "cute", aliases: ['cute'],
    lines: [[90, "Bunny-level cute."], [60, "Seriously adorable."], [30, "Cute on a good day."], [0, "Cute in their own way."]] });
