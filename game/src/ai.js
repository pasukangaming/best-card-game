// Sable, the Ash Warden — the AI opponent. It plays by simple, readable rules, so a player
// can learn its habits and counter them: it spends its mana on the strongest board it can
// afford, clears what threatens it, and otherwise goes for the hero.
import { affordableCards, attack, playCard } from './game.js';
import { cardById } from './cards.js';
import { pick } from './random.js';

/** How much is a card worth to the AI right now? Creatures are valued by stats per mana,
 * spells by the situation they answer. */
function cardValue(state, side, entry) {
  const card = entry.card;
  const foeSide = side.isFoe ? state.you : state.foe;
  if (card.kind === 'creature') {
    let value = card.attack + card.health - card.cost * 0.5;
    if (side.board.length >= 4) value -= 10;
    if (card.id === 'frost-wisp') value += 1.5;
    if (card.id === 'grove-keeper' && side.hp < 20) value += 3;
    if (card.id === 'ash-phoenix' && foeSide.board.length > 0) value += foeSide.board.length * 0.8;
    return value;
  }
  if (card.id === 'fireball') {
    if (foeSide.hp <= 3) return 20;
    const target = foeSide.board.find((c) => c.health <= 3 && c.attack >= 3);
    if (target) return 6;
    return foeSide.hp <= 12 ? 5 : 2;
  }
  if (card.id === 'mend') return side.hp <= 15 ? 7 : side.hp <= 24 ? 3 : -2;
  if (card.id === 'surge') return side.hand.length <= 3 ? 5 : 1;
  if (card.id === 'rally') return side.board.length >= 2 ? 4 + side.board.length : -2;
  if (card.id === 'quake') {
    const hurt = foeSide.board.filter((c) => c.health <= 2).length;
    return hurt > 0 ? 3 + hurt * 2 : -2;
  }
  return 1;
}

/** Pick a Fireball target: finish the hero, or remove the most dangerous creature. */
function fireballTarget(state, side) {
  const foeSide = side.isFoe ? state.you : state.foe;
  if (foeSide.hp <= 3) return { kind: 'hero', who: foeSide.isFoe ? 'foe' : 'you' };
  const dangerous = foeSide.board
    .filter((c) => c.health <= 3)
    .sort((a, b) => b.attack - a.attack)[0];
  if (dangerous) return { kind: 'creature', uid: dangerous.uid };
  return { kind: 'hero', who: foeSide.isFoe ? 'foe' : 'you' };
}

/** Play one card for `side`, the best it can afford. Returns true when it played something. */
export function playOneCard(state, side) {
  const options = affordableCards(state, side)
    .map((entry) => ({ ...entry, value: cardValue(state, side, entry) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
  if (options.length === 0) return false;
  const best = options[0];
  const target = best.card.id === 'fireball' ? fireballTarget(state, side) : null;
  const result = playCard(state, side, best.index, target);
  return result.ok;
}

/** Attack with every ready creature: kill what it can kill, then hit the hero.
 * A creature that would die for nothing holds back when the enemy is much bigger. */
export function attackWithAll(state, side) {
  const foeSide = side.isFoe ? state.you : state.foe;
  const acted = [];
  for (const creature of side.board.slice()) {
    if (!creature.canAttack || state.phase !== 'play') continue;
    const prey = foeSide.board
      .filter((enemy) => enemy.health <= creature.attack)
      .sort((a, b) => b.attack - a.attack)[0];
    if (prey) {
      attack(state, side, creature.uid, { kind: 'creature', uid: prey.uid });
      acted.push(creature.uid);
      continue;
    }
    const threat = foeSide.board.find((enemy) => enemy.attack >= creature.health + 2 && enemy.health <= creature.attack);
    if (threat && foeSide.hp > 10) {
      attack(state, side, creature.uid, { kind: 'creature', uid: threat.uid });
      acted.push(creature.uid);
      continue;
    }
    attack(state, side, creature.uid, { kind: 'hero', who: foeSide.isFoe ? 'foe' : 'you' });
    acted.push(creature.uid);
  }
  return acted;
}

/** One full AI turn: play cards while it can, then attack with everything. */
export function takeAiTurn(state) {
  const side = state.foe;
  let guard = 0;
  while (playOneCard(state, side) && guard < 12 && state.phase === 'play') guard += 1;
  if (state.phase === 'play') attackWithAll(state, side);
}

/** The autopilot for screenshots and for a "watch them play" demo: the player side also
 * uses the same brain, so a staged game is two AIs duelling under the real rules. */
export function takeAutoTurn(state, side) {
  let guard = 0;
  while (playOneCard(state, side) && guard < 12 && state.phase === 'play') guard += 1;
  if (state.phase === 'play') attackWithAll(state, side);
}

/** A small random nudge the autopilot uses so two staged games do not play identically. */
export function randomLegalNudge(state, side) {
  const options = affordableCards(state, side);
  if (options.length === 0) return false;
  const entry = pick(options, state.rng);
  const target = entry.card.id === 'fireball' ? fireballTarget(state, side) : null;
  return playCard(state, side, entry.index, target).ok;
}
