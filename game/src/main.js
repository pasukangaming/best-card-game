// Emberfall Duel — the app. It owns the state, the selection, the AI's pacing and the
// overlays, and asks the renderer to draw after every change. Screenshots arrive through
// ?shot=title|play|win|loss&seed=N, which stages a real game and shows the matching screen.
import { newGame, passToPlayer, startDuel } from './game.js';
import { takeAiTurn } from './ai.js';
import { freshSeed } from './random.js';
import { announce, hideOverlay, renderAll, showEnd, showHelp, showTitle, showToast } from './render.js';
import { bindInput, endTurnAction, handCardAction, targetAction, yourCreatureAction } from './input.js';
import { stageShot } from './shots.js';
import { isMuted, sounds, toggleMute } from './sound.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? '') || freshSeed();

let state = newGame(seed);
const ui = { selectedHand: null, selectedAttacker: null, targetMode: null };
let aiTimer = null;
let demoTimer = null;
let demoMode = false;

/** Draw the table from the state and the selection. */
function draw() {
  renderAll(state, ui);
}

/** Clear any selection the player had open. */
function clearSelection() {
  ui.selectedHand = null;
  ui.selectedAttacker = null;
  ui.targetMode = null;
}

/** After the player's move, check for the end, draw, and hand over to Sable. */
function afterPlayerMove() {
  clearSelection();
  draw();
  if (state.phase === 'over') return endDuel();
  if (state.active === 'you') return;
  runAiTurn();
}

/** Sable's turn, paced so the player can follow it: a short pause, then it acts. */
function runAiTurn() {
  window.clearTimeout(aiTimer);
  aiTimer = window.setTimeout(() => {
    if (state.phase !== 'play' || state.active !== 'you') {
      takeAiTurn(state);
      draw();
      if (state.phase === 'over') return endDuel();
      passToPlayer(state);
      sounds.turn();
      draw();
      if (demoMode) scheduleDemoTurn();
    }
  }, 650);
}

/** In demo mode the player's side plays itself too, so the table plays on alone. */
function scheduleDemoTurn() {
  window.clearTimeout(demoTimer);
  demoTimer = window.setTimeout(() => {
    if (!demoMode || state.phase !== 'play' || state.active !== 'you') return;
    import('./ai.js').then(({ takeAutoTurn }) => {
      takeAutoTurn(state, state.you);
      draw();
      if (state.phase === 'over') return endDuel();
      endTurnAction(state);
      draw();
      runAiTurn();
    });
  }, 900);
}

/** The duel is over: show the end screen and play its sound. */
function endDuel() {
  clearSelection();
  draw();
  if (state.winner === 'you') sounds.win();
  else sounds.lose();
  announce(state.winner === 'you' ? 'Victory! Sable falls.' : 'Defeat. The embers fade.');
  showEnd(state, () => restart(false));
}

/** A fresh duel with a fresh seed, back at the title screen. */
function restart(toTitle = true) {
  window.clearTimeout(aiTimer);
  window.clearTimeout(demoTimer);
  demoMode = false;
  state = newGame(freshSeed());
  clearSelection();
  draw();
  if (toTitle) showTitle(startPlaying);
  else startPlaying(false);
}

/** Leave the title screen and open the player's first turn. */
function startPlaying(demo = false) {
  demoMode = demo === true;
  hideOverlay();
  startDuel(state);
  sounds.turn();
  draw();
  announce('Your turn. Play a card or attack.');
  if (demoMode) scheduleDemoTurn();
}

/** Wire the table's clicks to the rules, through the input layer. */
bindInput({
  getState: () => state,
  onHandCard(handIndex) {
    if (state.phase !== 'play' || state.active !== 'you') return;
    const before = state.cardsPlayed;
    const result = handCardAction(state, ui, handIndex);
    if (result.action === 'played') {
      sounds.playCard();
      afterPlayerMove();
    } else if (result.action === 'target') {
      sounds.click();
      showToast(result.message);
      draw();
    } else if (result.action === 'deselect') {
      sounds.click();
      draw();
    }
    if (state.cardsPlayed !== before) announce('Card played.');
  },
  onYourCreature(uid) {
    if (state.phase !== 'play' || state.active !== 'you') return;
    const result = yourCreatureAction(state, ui, uid);
    if (result.action === 'target') {
      sounds.click();
      showToast(result.message);
      draw();
    } else if (result.action === 'deselect') {
      sounds.click();
      draw();
    }
  },
  onFoeCreature(uid) {
    if (state.phase !== 'play' || state.active !== 'you') return;
    if (ui.targetMode !== 'attack') return;
    const result = targetAction(state, ui, { kind: 'creature', uid });
    if (result.action === 'attacked') {
      sounds.attack();
      afterPlayerMove();
    } else if (result.action === 'played') {
      sounds.playCard();
      afterPlayerMove();
    } else draw();
  },
  onFoeHero() {
    if (state.phase !== 'play' || state.active !== 'you') return;
    if (ui.targetMode !== 'attack') return;
    const result = targetAction(state, ui, { kind: 'hero', who: 'foe' });
    if (result.action === 'attacked') {
      sounds.attack();
      afterPlayerMove();
    } else if (result.action === 'played') {
      sounds.playCard();
      afterPlayerMove();
    } else draw();
  },
  onYourHero() {
    if (state.phase !== 'play' || state.active !== 'you') return;
    if (ui.targetMode !== 'attack') return;
    const result = targetAction(state, ui, { kind: 'hero', who: 'you' });
    if (result.action === 'played') {
      sounds.playCard();
      afterPlayerMove();
    } else draw();
  },
  onEndTurn() {
    if (state.phase !== 'play' || state.active !== 'you') return;
    clearSelection();
    if (endTurnAction(state)) {
      sounds.turn();
      draw();
      runAiTurn();
    }
  },
  onCancel() {
    clearSelection();
    draw();
  },
});

/* Top-bar buttons. */
document.getElementById('btn-restart').addEventListener('click', () => restart(true));
document.getElementById('btn-help').addEventListener('click', () => showHelp(() => {
  hideOverlay();
  if (state.phase === 'title') showTitle(startPlaying);
}));
document.getElementById('btn-sound').addEventListener('click', (event) => {
  const nowMuted = toggleMute();
  event.currentTarget.textContent = `Sound: ${nowMuted ? 'off' : 'on'}`;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'm' || event.key === 'M') {
    const nowMuted = toggleMute();
    document.getElementById('btn-sound').textContent = `Sound: ${nowMuted ? 'off' : 'on'}`;
  }
  if ((event.key === 'r' || event.key === 'R') && !event.metaKey && !event.ctrlKey) restart(true);
});

/* Boot: a screenshot scene stages a real game; otherwise the title screen opens. */
if (shotName) {
  startDuel(state);
  const staged = stageShot(shotName, state);
  if (staged.screen === 'title') {
    draw();
    showTitle(() => startPlaying(false));
  } else if (staged.screen === 'play') {
    draw();
  } else {
    draw();
    showEnd(state, () => restart(false));
  }
} else {
  draw();
  showTitle(startPlaying);
}
