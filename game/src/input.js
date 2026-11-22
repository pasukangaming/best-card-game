// Emberfall Duel — input. Clicks on the hand, the boards and the heroes, plus the
// keyboard: 1-9 plays a hand card, Space ends the turn, Esc cancels, M mutes, R restarts.
// A click never touches the rules directly; it asks the game, then the renderer shows it.
import { attack, endTurn, playCard } from './game.js';
import { cardById } from './cards.js';
import { showToast } from './render.js';

/**
 * Wire the table's clicks and keys.
 * `hooks` carries what input needs from the app: the state getter, the UI selection,
 * re-render, the AI turn runner, the end-of-game sound and the restart.
 */
export function bindInput(hooks) {
  const handEl = document.getElementById('hand');
  const youBoardEl = document.getElementById('you-board');
  const foeBoardEl = document.getElementById('foe-board');
  const foeHeroEl = document.querySelector('#foe-zone .hero-card');
  const youHeroEl = document.querySelector('#you-zone .hero-card');

  handEl.addEventListener('click', (event) => {
    const node = event.target.closest('.card');
    if (!node || node.dataset.handIndex === undefined) return;
    hooks.onHandCard(Number(node.dataset.handIndex));
  });

  youBoardEl.addEventListener('click', (event) => {
    const node = event.target.closest('.card');
    if (!node || node.dataset.uid === undefined) return;
    hooks.onYourCreature(Number(node.dataset.uid));
  });

  foeBoardEl.addEventListener('click', (event) => {
    const node = event.target.closest('.card');
    if (!node || node.dataset.uid === undefined) return;
    hooks.onFoeCreature(Number(node.dataset.uid));
  });

  foeHeroEl.addEventListener('click', () => hooks.onFoeHero());
  youHeroEl.addEventListener('click', () => hooks.onYourHero());

  document.getElementById('btn-end-turn').addEventListener('click', () => hooks.onEndTurn());

  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const state = hooks.getState();
    if (event.key === 'Escape') {
      hooks.onCancel();
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      const overlayOpen = !document.getElementById('overlay').classList.contains('hidden');
      if (state.phase === 'play' && state.active === 'you' && !overlayOpen) {
        event.preventDefault();
        hooks.onEndTurn();
      }
      return;
    }
    if (event.key >= '1' && event.key <= '9') {
      hooks.onHandCard(Number(event.key) - 1);
    }
  });
}

/**
 * What a hand-card click means, given the current selection. Kept here so the app's
 * click handler stays a short switch: a selected card is played, otherwise it is selected.
 */
export function handCardAction(state, ui, handIndex) {
  const id = state.you.hand[handIndex];
  const card = id ? cardById(id) : null;
  if (!card) return { action: 'none' };
  if (ui.selectedHand === handIndex) {
    ui.selectedHand = null;
    ui.targetMode = null;
    return { action: 'deselect' };
  }
  if (state.phase !== 'play' || state.active !== 'you') return { action: 'none' };
  if (card.cost > state.you.mana) {
    showToast(`Need ${card.cost} mana — you have ${state.you.mana}.`);
    return { action: 'none' };
  }
  if (card.kind === 'spell' && card.id === 'fireball') {
    ui.selectedHand = handIndex;
    ui.targetMode = 'attack';
    return { action: 'target', message: 'Choose a target for Fireball.' };
  }
  const result = playCard(state, state.you, handIndex, null);
  if (!result.ok) showToast(result.message);
  return { action: result.ok ? 'played' : 'none', result };
}

/** Resolve a click on a target while a card or a creature waits for one. */
export function targetAction(state, ui, target) {
  if (ui.targetMode === 'attack' && ui.selectedAttacker !== null) {
    const result = attack(state, state.you, ui.selectedAttacker, target);
    ui.selectedAttacker = null;
    ui.targetMode = null;
    if (!result.ok) showToast(result.message);
    return { action: result.ok ? 'attacked' : 'none', result };
  }
  if (ui.targetMode === 'attack' && ui.selectedHand !== null) {
    const result = playCard(state, state.you, ui.selectedHand, target);
    ui.selectedHand = null;
    ui.targetMode = null;
    if (!result.ok) showToast(result.message);
    return { action: result.ok ? 'played' : 'none', result };
  }
  return { action: 'none' };
}

/** What a click on one of your own creatures means: select it to attack, or deselect it. */
export function yourCreatureAction(state, ui, uid) {
  if (state.phase !== 'play' || state.active !== 'you') return { action: 'none' };
  const creature = state.you.board.find((c) => c.uid === uid);
  if (!creature) return { action: 'none' };
  if (ui.selectedAttacker === uid) {
    ui.selectedAttacker = null;
    ui.targetMode = null;
    return { action: 'deselect' };
  }
  if (!creature.canAttack) {
    showToast(`${creature.name} is tired — it just arrived or already struck.`);
    return { action: 'none' };
  }
  ui.selectedAttacker = uid;
  ui.targetMode = 'attack';
  return { action: 'target', message: `Choose a target for ${creature.name}.` };
}

/** End the player's turn through the rules; false when it is not their turn. */
export function endTurnAction(state) {
  return endTurn(state);
}
