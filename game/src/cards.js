// The card pool of Emberfall Duel: 15 original designs in four suits.
// A suit is told by colour AND by its shape (flame, drop, leaf, mountain), never by text alone.
// Resonance: the second card of one suit you play in a turn is empowered (+1/+1 for a
// creature, +1 damage or +2 healing or +1 card for a spell).
export const SUITS = {
  ember: { name: 'Ember', color: '#e4572e', glyph: 'flame' },
  tide: { name: 'Tide', color: '#2e86e4', glyph: 'drop' },
  leaf: { name: 'Leaf', color: '#4caf50', glyph: 'leaf' },
  stone: { name: 'Stone', color: '#c98f2d', glyph: 'mountain' },
};

/** Every card design. `text` is what the card shows; the rules engine implements it. */
export const CARDS = [
  { id: 'ember-pup', name: 'Ember Pup', suit: 'ember', cost: 1, kind: 'creature', attack: 2, health: 1, text: 'A spark with teeth.' },
  { id: 'frost-wisp', name: 'Frost Wisp', suit: 'tide', cost: 1, kind: 'creature', attack: 1, health: 2, text: 'Draw a card when played.' },
  { id: 'cinder-imp', name: 'Cinder Imp', suit: 'ember', cost: 2, kind: 'creature', attack: 3, health: 2, text: 'It giggles as it burns.' },
  { id: 'thorn-wolf', name: 'Thorn Wolf', suit: 'leaf', cost: 2, kind: 'creature', attack: 2, health: 3, text: 'Thorns answer thorns.' },
  { id: 'surge', name: 'Surge', suit: 'tide', cost: 1, kind: 'spell', text: 'Draw 2 cards.' },
  { id: 'fireball', name: 'Fireball', suit: 'ember', cost: 2, kind: 'spell', text: 'Deal 3 damage to any target.' },
  { id: 'mend', name: 'Mend', suit: 'leaf', cost: 2, kind: 'spell', text: 'Heal your hero for 6.' },
  { id: 'rally', name: 'Rally', suit: 'leaf', cost: 2, kind: 'spell', text: 'Your creatures gain +1/+1.' },
  { id: 'tide-serpent', name: 'Tide Serpent', suit: 'tide', cost: 3, kind: 'creature', attack: 3, health: 4, text: 'It swims through embers.' },
  { id: 'grove-keeper', name: 'Grove Keeper', suit: 'leaf', cost: 3, kind: 'creature', attack: 2, health: 5, text: 'Heal your hero 3 when played.' },
  { id: 'quake', name: 'Quake', suit: 'stone', cost: 3, kind: 'spell', text: 'Deal 2 damage to all enemy creatures.' },
  { id: 'stone-golem', name: 'Stone Golem', suit: 'stone', cost: 4, kind: 'creature', attack: 4, health: 6, text: 'It does not hurry. It does not fall.' },
  { id: 'ash-phoenix', name: 'Ash Phoenix', suit: 'ember', cost: 5, kind: 'creature', attack: 5, health: 4, text: 'Deal 1 to all enemies when played.' },
  { id: 'ember-drake', name: 'Ember Drake', suit: 'ember', cost: 6, kind: 'creature', attack: 6, health: 5, text: 'The sky catches fire.' },
  { id: 'tide-leviathan', name: 'Leviathan', suit: 'tide', cost: 6, kind: 'creature', attack: 5, health: 7, text: 'The tide answers no one.' },
];

export const MAX_COPIES = 2;
export const DECK_SIZE = 30;
export const MAX_HAND = 10;
export const MAX_BOARD = 4;

/** Look a card design up by id. */
export function cardById(id) {
  return CARDS.find((card) => card.id === id) ?? null;
}

/** A fresh 30-card deck: two copies of every design, shuffled by the game's rng. */
export function buildDeck(shuffleFn) {
  const ids = [];
  for (const card of CARDS) {
    for (let copy = 0; copy < MAX_COPIES; copy += 1) ids.push(card.id);
  }
  return shuffleFn(ids);
}

/** A new creature on the board, copied from its design with its own identity. */
export function makeCreature(card, uid, resonance) {
  return {
    uid,
    cardId: card.id,
    name: card.name,
    suit: card.suit,
    attack: card.attack + (resonance ? 1 : 0),
    health: card.health + (resonance ? 1 : 0),
    maxHealth: card.health + (resonance ? 1 : 0),
    canAttack: false,
    justPlayed: true,
  };
}

/** Small inline SVG glyphs for the four suits, drawn by shape as well as colour. */
export function suitGlyph(glyph, color) {
  if (glyph === 'flame') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${color}" d="M12 1.5c1.2 3.4 4.6 5.6 6.2 9.2 1.3 2.9.7 6.4-1.6 8.6-1.9 1.8-4.6 2.4-7.1 1.5-3-1-4.9-3.9-4.6-7 .2-2.3 1.6-4 3-5.6.4 1.6 1.1 2.7 2.3 3.4-.4-3.4.2-7 1.8-10.1z"/></svg>`;
  }
  if (glyph === 'drop') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${color}" d="M12 1.5c3.2 4.3 6.5 8.1 6.5 12a6.5 6.5 0 1 1-13 0c0-3.9 3.3-7.7 6.5-12z"/></svg>`;
  }
  if (glyph === 'leaf') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${color}" d="M20.5 3.5C11 3.5 4.5 8.5 3.5 17c-.1 1 .8 1.8 1.8 1.6 8-1.3 13.4-7.4 15.2-15.1z"/><path fill="none" stroke="#ffffff" stroke-width="1.4" d="M6 18C9 13 13 9 18 6"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${color}" d="M12 2.5 20 19.5H16.4L12 10.8 8.9 16.5 7.4 19.5H4L12 2.5z"/><path fill="#ffffff" opacity="0.85" d="M12 2.5 14.6 8 12 6.4 9.8 8.6 12 2.5z"/></svg>`;
}
