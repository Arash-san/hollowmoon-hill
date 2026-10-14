// The night's story. Madame Hex has a vision: before the night is over, someone everyone trusts will try to turn
// Hollowmoon Hill into pumpkins. Quests reveal clues that point at Mayor Gourdon; near the end of the event the
// officers start the finale and he shows his true face as the giant Pumpkin King.

export const PROPHECY = {
  from: 'Madame Hex',
  icon: '🔮',
  text: "Hehehe… sit down, dearie. Last night my cauldron showed me a vision. Before this night is over, someone will try to turn ALL of Hollowmoon Hill into pumpkins! And it's someone we all trust… The clues are hidden in the town's little jobs. Find them, and be ready to fight together when the time comes!",
};

// Each clue is found by finishing the quest it belongs to.
export const CLUES = [
  { id: 'patch', quest: 'harvest', icon: '🎃', text: "Hay-ley's notebook: \"The biggest pumpkins vanish every night… always rolling toward the Mayor's stall.\"" },
  { id: 'wisp', quest: 'wisps', icon: '🫙', text: 'A wisp in your jar squeaks: "Top hat… a tall top hat… he is collecting us!"' },
  { id: 'grave', quest: 'candles', icon: '🪦', text: 'Scratched on an old grave: "Here lies the REAL mayor. So who is wearing his hat?"' },
  { id: 'riddle', quest: 'riddle', icon: '👻', text: 'Professor Wisp whispers: "I kiss babies, I give speeches, and my head is hollow. Beware of me."' },
  { id: 'ledger', quest: 'deal', icon: '🦇', text: 'Count Snackula\'s ledger: "Mayor G. borrowed 9,000 candy for one GIANT pumpkin spell."' },
  { id: 'vision', quest: 'ritual', icon: '🔮', text: 'The Great Pumpkin Spirit shows you a vision: a top hat floating over a town full of pumpkins.' },
];
export const CLUES_NEEDED = 4;

export const FINALE_SPEECH = "Citizens of Hollowmoon Hill! You thought I was just a jolly old mayor? Fools! All night you picked MY pumpkins and collected MY candy. Now I will turn every last one of you into a pumpkin! Behold… the PUMPKIN KING!";
