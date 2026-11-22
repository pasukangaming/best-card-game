// Emberfall Duel — the screenshot scenes behind ?shot=title|play|win|loss.
// Each scene plays the real rules forward from a fresh duel, steered by the same AI that
// plays the foe, so every frame is what a short game really looks like — and the same
// seed always gives the same frame. The win and loss scenes search seeds for a duel the
// autopilot wins or loses, so the end screens show a real finish.
import { checkEnd, endTurn, newGame, passToPlayer, startDuel } from './game.js';
import { takeAiTurn, takeAutoTurn } from './ai.js';

const MAX_TURNS = 80;
const PLAY_TURNS = 8;

/** Play one full round (your turn, then Sable's) with both sides on autopilot. */
function autoRound(state) {
  if (state.phase !== 'play') return;
  takeAutoTurn(state, state.you);
  if (state.phase !== 'play') return;
  endTurn(state);
  takeAiTurn(state);
  if (state.phase !== 'play') return;
  passToPlayer(state);
}

/** Play a duel to its end (or the turn cap) and report how it finished. */
function playOut(state) {
  while (state.phase === 'play' && state.turnCount < MAX_TURNS) autoRound(state);
  checkEnd(state);
  return state;
}

/** Find a seed whose autopilot duel ends with `winner` ('you' or 'foe'). */
export function findSeedFor(winner) {
  for (let seed = 1; seed <= 200; seed += 1) {
    const state = newGame(seed);
    startDuel(state);
    playOut(state);
    if (state.phase === 'over' && state.winner === winner) return seed;
  }
  return null;
}

/**
 * Set `state` to the named scene and return the screen to show over it:
 * 'title' for the title screen, 'play' for the table, 'over' for an end screen.
 * Any other name is the title scene.
 */
export function stageShot(name, state) {
  if (name === 'play') {
    while (state.phase === 'play' && state.turnCount < PLAY_TURNS) autoRound(state);
    // Stop at the opening of your turn, mana full and hand in hand: the table at its
    // most readable, both boards occupied and a decision waiting.
    return { screen: 'play', seed: state.seed };
  }
  if (name === 'win' || name === 'loss') {
    const wanted = name === 'win' ? 'you' : 'foe';
    const seed = findSeedFor(wanted);
    if (seed === null) return { screen: 'title', seed: state.seed };
    const finished = newGame(seed);
    startDuel(finished);
    playOut(finished);
    Object.assign(state, finished);
    return { screen: 'over', seed };
  }
  return { screen: 'title', seed: state.seed };
}
