// Original lines (not lyrics), with a little moon and orbit flavour.
const LINES = [
    "Even the moon has phases. Resting is part of the cycle.",
    "You don't have to shine all at once. One step at a time still counts.",
    "Every orbit starts with a single loop. Keep going.",
    "Small progress is still progress.",
    "The stars don't compete with each other. Go at your own pace.",
    "Drink some water, stretch, and try again. You've got this.",
    "Hard days end. Tomorrow is a fresh lap around the sun.",
    "You've made it through every bad day so far. That's a perfect record.",
    "Be proud of how far you've come, not just where you're going.",
    "It's okay to ask for help. Even planets need gravity.",
    "Done is better than perfect.",
    "Be the kind of person your past self needed.",
    "Your pace is still a pace. Don't stop moving.",
    "One good thing today is enough.",
];

module.exports = {
    name: "motivation",
    description: 'A little encouragement.',
    aliases: ['motivate'],
    LINES,
    run: async (client, message, args) => message.reply(`🌙 ${LINES[Math.floor(Math.random() * LINES.length)]}`),
};
