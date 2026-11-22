// Emberfall Duel — the rules engine. Pure state and rules: no DOM, no sound, no network.
// The renderer reads `state` and the input layer calls these functions; the screenshot
// autopilot drives them too, so a staged game is a real game played forward.
import { buildDeck, cardById, makeCreature, MAX_BOARD, MAX_HAND } from './cards.js';
import { makeRng, shuffle } from './random.js';

export const START_HP = 30;
export const MAX_MANA = 10;
export const START_HAND = 3;

let nextUid = 1;

/** One side of the duel: hero, hand, deck, board and mana. */
function makeSide(name, isFoe) {
  return {
    name,
    isFoe,
    hp: START_HP,
    maxHp: START_HP,
    mana: 0,
    maxMana: 0,
    deck: [],
    hand: [],
    board: [],
    playedSuits: [],
    fatigue: 0,
  };
}

/** A fresh duel. `seed` fixes every shuffle and AI tie-break of this game. */
export function newGame(seed) {
  nextUid = 1;
  const rng = makeRng(seed);
  const state = {
    seed,
    rng,
    turn: 0,
    phase: 'title', // title | play | over
    winner: null, // 'you' | 'foe' | null
    active: 'you',
    you: makeSide('You', false),
    foe: makeSide('Sable', true),
    log: [],
    turnCount: 0,
    cardsPlayed: 0,
    damageDealt: { you: 0, foe: 0 },
  };
  state.you.deck = buildDeck((ids) => shuffle(ids, rng));
  state.foe.deck = buildDeck((ids) => shuffle(ids, rng));
  for (let i = 0; i < START_HAND; i += 1) {
    drawCard(state, state.you, true);
    drawCard(state, state.foe, true);
  }
  return state;
}

/** Start the duel from the title screen: your first turn. */
export function startDuel(state) {
  state.phase = 'play';
  state.active = 'you';
  beginTurn(state, state.you);
  return state;
}

/** Draw one card; an empty deck deals fatigue damage instead. */
export function drawCard(state, side, silent = false) {
  if (side.hand.length >= MAX_HAND) {
    if (!silent) addLog(state, `${side.name} hand is full — the card burns away.`, side.isFoe ? 'foe' : 'you');
    return null;
  }
  if (side.deck.length === 0) {
    side.fatigue += 1;
    damageHero(state, side, side.fatigue, 'fatigue');
    return null;
  }
  const id = side.deck.pop();
  side.hand.push(id);
  return id;
}

/** Open a side's turn: one more mana crystal, a fresh card, creatures ready to strike. */
export function beginTurn(state, side) {
  state.turnCount += 1;
  side.maxMana = Math.min(MAX_MANA, side.maxMana + 1);
  side.mana = side.maxMana;
  side.playedSuits = [];
  for (const creature of side.board) creature.canAttack = true;
  drawCard(state, side);
  addLog(state, `Turn ${state.turnCount} — ${side.name} ${side.isFoe ? 'plots' : 'acts'} (${side.mana} mana).`, 'turn');
}

/** Close a side's turn and open the other's. */
export function endTurn(state) {
  if (state.phase !== 'play' || state.active !== 'you') return false;
  state.active = 'foe';
  beginTurn(state, state.foe);
  return true;
}

/** Hand the turn back to the player after the foe has acted. */
export function passToPlayer(state) {
  state.active = 'you';
  beginTurn(state, state.you);
}

/** Is this the second (or later) card of `suit` played this turn? That is Resonance. */
export function resonanceFor(state, side, suit) {
  return side.playedSuits.includes(suit);
}

/** Which cards in `side`'s hand can be afforded right now? */
export function affordableCards(state, side) {
  return side.hand
    .map((id, index) => ({ id, index, card: cardById(id) }))
    .filter((entry) => entry.card && entry.card.cost <= side.mana);
}

/** Play the hand card at `handIndex` for `side`. Spells with a target need `target`:
 *  { kind: 'hero', who: 'you'|'foe' } or { kind: 'creature', uid }.
 * Returns { ok, message } and writes to the log. */
export function playCard(state, side, handIndex, target = null) {
  if (state.phase !== 'play') return { ok: false, message: 'The duel has not begun.' };
  const id = side.hand[handIndex];
  const card = id ? cardById(id) : null;
  if (!card) return { ok: false, message: 'No such card.' };
  if (card.cost > side.mana) return { ok: false, message: `Need ${card.cost} mana — you have ${side.mana}.` };
  if (card.kind === 'creature' && side.board.length >= MAX_BOARD) {
    return { ok: false, message: 'Your board is full (4 creatures).' };
  }
  const resonance = resonanceFor(state, side, card.suit);
  side.mana -= card.cost;
  side.hand.splice(handIndex, 1);
  side.playedSuits.push(card.suit);
  state.cardsPlayed += 1;

  if (card.kind === 'creature') {
    const creature = makeCreature(card, nextUid, resonance);
    nextUid += 1;
    side.board.push(creature);
    addLog(state, `${side.name} summons ${card.name} (${creature.attack}/${creature.health})${resonance ? ' — RESONANCE +1/+1!' : ''}.`, side.isFoe ? 'foe' : 'you');
    applyBattlecry(state, side, card, resonance);
    checkEnd(state);
    return { ok: true, message: `${card.name} joins the battle.`, creature };
  }

  const result = castSpell(state, side, card, target, resonance);
  checkEnd(state);
  return result;
}

/** A creature's "when played" line, if it has one. */
function applyBattlecry(state, side, card, resonance) {
  const foeSide = side.isFoe ? state.you : state.foe;
  if (card.id === 'frost-wisp') {
    drawCard(state, side);
    addLog(state, 'Frost Wisp whispers — draw a card.', side.isFoe ? 'foe' : 'you');
  } else if (card.id === 'grove-keeper') {
    healHero(state, side, 3 + (resonance ? 2 : 0));
  } else if (card.id === 'ash-phoenix') {
    const amount = 1 + (resonance ? 1 : 0);
    addLog(state, `Ash Phoenix bursts — ${amount} damage to all enemy creatures!`, side.isFoe ? 'foe' : 'you');
    for (const creature of foeSide.board.slice()) damageCreature(state, foeSide, creature, amount, side);
  }
}

/** Cast a spell. Targeted spells need a valid `target`; the others need none. */
export function castSpell(state, side, card, target, resonance) {
  const foeSide = side.isFoe ? state.you : state.foe;
  const who = side.isFoe ? 'foe' : 'you';
  if (card.id === 'fireball') {
    const resolved = resolveTarget(state, target, side);
    if (!resolved.ok) return resolved;
    const amount = 3 + (resonance ? 1 : 0);
    addLog(state, `${side.name} hurls a Fireball for ${amount}!`, who);
    if (resolved.kind === 'hero') damageHero(state, resolved.side, amount, side);
    else damageCreature(state, resolved.side, resolved.creature, amount, side);
    return { ok: true, message: `Fireball hits for ${amount}.` };
  }
  if (card.id === 'mend') {
    healHero(state, side, 6 + (resonance ? 2 : 0));
    return { ok: true, message: 'Mended.' };
  }
  if (card.id === 'surge') {
    const count = 2 + (resonance ? 1 : 0);
    for (let i = 0; i < count; i += 1) drawCard(state, side);
    addLog(state, `${side.name} rides the Surge — draws ${count}.`, who);
    return { ok: true, message: `Drew ${count} cards.` };
  }
  if (card.id === 'rally') {
    const bonus = resonance ? 2 : 1;
    for (const creature of side.board) {
      creature.attack += bonus;
      creature.health += bonus;
      creature.maxHealth += bonus;
    }
    addLog(state, `${side.name} sounds the Rally — creatures +${bonus}/+${bonus}!`, who);
    return { ok: true, message: 'Your creatures rally!' };
  }
  if (card.id === 'quake') {
    const amount = 2 + (resonance ? 1 : 0);
    addLog(state, `${side.name} shakes the earth — ${amount} to all enemy creatures!`, who);
    for (const creature of foeSide.board.slice()) damageCreature(state, foeSide, creature, amount, side);
    return { ok: true, message: `Quake hits every enemy for ${amount}.` };
  }
  return { ok: false, message: 'Unknown spell.' };
}

/** Turn a spell target descriptor into a concrete hero or creature. */
export function resolveTarget(state, target, casterSide) {
  if (!target || typeof target !== 'object') return { ok: false, message: 'Choose a target.' };
  if (target.kind === 'hero') {
    if (target.who !== 'you' && target.who !== 'foe') return { ok: false, message: 'Choose a hero.' };
    return { ok: true, kind: 'hero', side: target.who === 'you' ? state.you : state.foe };
  }
  if (target.kind === 'creature') {
    const both = [...state.you.board, ...state.foe.board];
    const creature = both.find((c) => c.uid === target.uid);
    if (!creature) return { ok: false, message: 'That creature is gone.' };
    const side = state.you.board.includes(creature) ? state.you : state.foe;
    return { ok: true, kind: 'creature', side, creature };
  }
  return { ok: false, message: 'Choose a target.' };
}

/** One creature strikes another (or a hero). The target fights back when it is a creature. */
export function attack(state, side, attackerUid, target) {
  if (state.phase !== 'play') return { ok: false, message: 'The duel has not begun.' };
  const attacker = side.board.find((c) => c.uid === attackerUid);
  if (!attacker) return { ok: false, message: 'No such creature.' };
  if (!attacker.canAttack) return { ok: false, message: `${attacker.name} already struck, or just arrived.` };
  const resolved = resolveTarget(state, target, side);
  if (!resolved.ok) return resolved;
  if (resolved.kind === 'creature' && resolved.side === side) {
    return { ok: false, message: 'Strike the enemy, not your own.' };
  }
  attacker.canAttack = false;
  const who = side.isFoe ? 'foe' : 'you';
  if (resolved.kind === 'hero') {
    addLog(state, `${attacker.name} strikes ${resolved.side.name} for ${attacker.attack}!`, who);
    damageHero(state, resolved.side, attacker.attack, side);
  } else {
    addLog(state, `${attacker.name} (${attacker.attack}/${attacker.health}) clashes with ${resolved.creature.name} (${resolved.creature.attack}/${resolved.creature.health})!`, who);
    damageCreature(state, resolved.side, resolved.creature, attacker.attack, side);
    damageCreature(state, side, attacker, resolved.creature.attack, resolved.side);
  }
  checkEnd(state);
  return { ok: true, message: 'Attack!' };
}

/** Damage a hero; the attacker (a side) is credited for the score line. */
export function damageHero(state, side, amount, sourceSide) {
  side.hp = Math.max(0, side.hp - amount);
  if (sourceSide && sourceSide !== side) {
    const key = sourceSide.isFoe ? 'foe' : 'you';
    state.damageDealt[key] += amount;
  }
  if (amount >= 6) addLog(state, `${side.name} takes a heavy blow: ${amount} damage!`, 'bad');
}

/** Heal a hero, never past its maximum. */
export function healHero(state, side, amount) {
  const before = side.hp;
  side.hp = Math.min(side.maxHp, side.hp + amount);
  const healed = side.hp - before;
  if (healed > 0) addLog(state, `${side.name} recovers ${healed} health.`, 'good');
  return healed;
}

/** Damage a creature; at 0 health it leaves the board. */
export function damageCreature(state, side, creature, amount, sourceSide) {
  creature.health -= amount;
  creature.hitFlash = true;
  if (creature.health <= 0) {
    side.board = side.board.filter((c) => c.uid !== creature.uid);
    addLog(state, `${creature.name} falls!`, side.isFoe ? 'you' : 'foe');
  }
}

/** Has either hero fallen? End the duel and name the winner. */
export function checkEnd(state) {
  if (state.phase !== 'play') return;
  if (state.foe.hp <= 0 && state.you.hp <= 0) {
    state.phase = 'over';
    state.winner = state.damageDealt.you >= state.damageDealt.foe ? 'you' : 'foe';
  } else if (state.foe.hp <= 0) {
    state.phase = 'over';
    state.winner = 'you';
  } else if (state.you.hp <= 0) {
    state.phase = 'over';
    state.winner = 'foe';
  }
  if (state.phase === 'over') {
    addLog(state, state.winner === 'you' ? 'VICTORY — Sable falls!' : 'DEFEAT — the embers fade.', state.winner === 'you' ? 'good' : 'bad');
  }
}

/** Append a line to the battle log (kept short so the panel stays readable). */
export function addLog(state, text, kind = '') {
  state.log.push({ text, kind });
  if (state.log.length > 60) state.log.splice(0, state.log.length - 60);
}

/** A one-line summary of the duel so far, for the end screens. */
export function duelSummary(state) {
  return {
    turns: state.turnCount,
    cardsPlayed: state.cardsPlayed,
    damageDealt: state.damageDealt.you,
    damageTaken: START_HP - state.you.hp,
  };
}
