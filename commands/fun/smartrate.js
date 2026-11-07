const { rateCommand } = require("../../fun/rate");

module.exports = rateCommand({ kind: "smart", adjective: "smart", aliases: ['smart'],
    lines: [[90, "Big brain energy."], [60, "Pretty clever."], [30, "Smart enough."], [0, "Maybe tomorrow."]] });
