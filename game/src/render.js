// Emberfall Duel — the renderer. It turns `state` into DOM: heroes, boards, hand, log and
// overlays. It never changes the rules; it only shows them. Every re-render rebuilds the
// table from the state, so the screen can never drift from the game.
import { SUITS, cardById, suitGlyph } from './cards.js';
import { duelSummary } from './game.js';

const $ = (id) => document.getElementById(id);

/** One card's face, as a DOM element. `where` is 'hand' or 'board'. */
export function cardElement(card, opts = {}) {
  const suit = SUITS[card.suit];
  const el = document.createElement('div');
  el.className = `card suit-${card.suit}`;
  el.dataset.cardId = card.id;
  if (opts.uid !== undefined) el.dataset.uid = String(opts.uid);
  if (opts.selected) el.classList.add('selected');
  if (opts.unaffordable) el.classList.add('unaffordable');
  if (opts.canAttack) el.classList.add('can-attack');
  if (opts.exhausted) el.classList.add('exhausted');
  if (opts.targetable) el.classList.add('targetable');
  if (opts.justPlayed) el.classList.add('just-played');
  if (opts.hitFlash) el.classList.add('hit');
  if (opts.yours) el.classList.add('yours');

  const art = suitGlyph(suit.glyph, suit.color);
  const stats = card.kind === 'creature'
    ? `<div class="stats"><span class="atk" title="Attack">${opts.attack ?? card.attack}</span><span class="hp" title="Health">${opts.health ?? card.health}</span></div>`
    : `<div class="stats"><span class="spell-tag">SPELL</span></div>`;
  const resonance = opts.resonance ? '<span class="resonance">RESONANCE</span>' : '';
  el.innerHTML = `
    <span class="suit-band"></span>
    <span class="cost" title="Mana cost">${card.cost}</span>
    <span class="suit-mark" title="${suit.name} suit">${suitGlyph(suit.glyph, suit.color)}</span>
    ${resonance}
    <div class="art">${art}</div>
    <div class="name">${card.name}</div>
    <div class="text">${card.text}</div>
    ${stats}`;
  return el;
}

/** A row of mana pips: filled ones are mana left, hollow ones are spent or unfilled. */
function manaPips(el, mana, maxMana) {
  let html = '';
  for (let i = 0; i < maxMana; i += 1) {
    html += `<span class="mana-pip ${i < mana ? 'full' : 'empty'}"></span>`;
  }
  html += `<span class="mana-num">${mana}/${maxMana}</span>`;
  el.innerHTML = html;
}

/** Render one hero's portrait, health and mana. */
function renderHero(prefix, side) {
  $(`${prefix}-hp`).textContent = String(side.hp);
  $(`${prefix}-hpbar-fill`).style.width = `${Math.max(0, (side.hp / side.maxHp) * 100)}%`;
  manaPips($(`${prefix}-mana`), side.mana, side.maxMana);
  $(`${prefix}-deck-count`).textContent = String(side.deck.length);
}

/** Render one board row. `opts` carries the selection state for clicks. */
function renderBoard(el, side, opts) {
  el.innerHTML = '';
  if (side.board.length === 0) {
    const hint = document.createElement('span');
    hint.className = 'empty-hint';
    hint.textContent = side.isFoe ? 'No creatures yet — the Warden plots.' : 'No creatures yet — summon one from your hand.';
    el.appendChild(hint);
    return;
  }
  for (const creature of side.board) {
    const card = cardById(creature.cardId);
    const node = cardElement(card, {
      uid: creature.uid,
      attack: creature.attack,
      health: creature.health,
      yours: !side.isFoe,
      canAttack: !side.isFoe && creature.canAttack && opts.phase === 'play' && opts.active === 'you',
      exhausted: !side.isFoe && !creature.canAttack,
      selected: opts.selectedAttacker === creature.uid,
      targetable: opts.targetMode === 'attack' && side.isFoe,
      justPlayed: creature.justPlayed,
      hitFlash: creature.hitFlash,
    });
    creature.justPlayed = false;
    creature.hitFlash = false;
    el.appendChild(node);
  }
}

/** Render the player's hand. `selection` is the hand index awaiting a target, if any. */
function renderHand(state, ui) {
  const handEl = $('hand');
  handEl.innerHTML = '';
  $('hand-count').textContent = `(${state.you.hand.length} cards)`;
  if (state.you.hand.length === 0) {
    const hint = document.createElement('span');
    hint.className = 'empty-hint';
    hint.textContent = 'Your hand is empty — draw next turn.';
    handEl.appendChild(hint);
    return;
  }
  state.you.hand.forEach((id, index) => {
    const card = cardById(id);
    const resonance = state.you.playedSuits.includes(card.suit);
    const node = cardElement(card, {
      selected: ui.selectedHand === index,
      unaffordable: card.cost > state.you.mana || state.active !== 'you' || state.phase !== 'play',
      resonance,
    });
    node.dataset.handIndex = String(index);
    handEl.appendChild(node);
  });
}

/** Render the battle log, newest lines at the bottom. */
function renderLog(state) {
  const logEl = $('log');
  logEl.innerHTML = state.log.map((line) => {
    const cls = line.kind ? ` class="log-${line.kind}"` : '';
    return `<div${cls}>${escapeHtml(line.text)}</div>`;
  }).join('');
  logEl.scrollTop = logEl.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Render the opponent's hidden hand as a fan of card backs. */
function renderFoeHand(state) {
  const el = $('foe-hand');
  el.innerHTML = '';
  for (let i = 0; i < state.foe.hand.length; i += 1) {
    const back = document.createElement('span');
    back.className = 'mini-back';
    el.appendChild(back);
  }
}

/** The whole table, from the state and the UI selection. */
export function renderAll(state, ui) {
  renderHero('you', state.you);
  renderHero('foe', state.foe);
  renderBoard($('foe-board'), state.foe, { phase: state.phase, active: state.active, targetMode: ui.targetMode, selectedAttacker: null });
  renderBoard($('you-board'), state.you, { phase: state.phase, active: state.active, targetMode: ui.targetMode, selectedAttacker: ui.selectedAttacker });
  renderHand(state, ui);
  renderFoeHand(state);
  renderLog(state);
  const banner = $('turn-banner');
  if (state.phase === 'over') {
    banner.textContent = state.winner === 'you' ? 'Victory!' : 'Defeat';
    banner.className = state.winner === 'you' ? 'yours' : 'theirs';
  } else if (state.active === 'you') {
    banner.textContent = 'Your turn — play a card or attack';
    banner.className = 'yours';
  } else {
    banner.textContent = 'Sable is thinking…';
    banner.className = 'theirs';
  }
  $('btn-end-turn').disabled = state.phase !== 'play' || state.active !== 'you';
  $('foe-zone').querySelector('.hero-card').classList.toggle('targetable', ui.targetMode === 'spell-hero' || ui.targetMode === 'attack');
  $('you-zone').querySelector('.hero-card').classList.toggle('targetable', ui.targetMode === 'spell-hero-self');
}

/** The title screen: the game, its rules and its suits, on one card. */
export function showTitle(onPlay) {
  const overlay = $('overlay');
  const card = $('overlay-card');
  card.innerHTML = `
    <span class="big-flame" aria-hidden="true"></span>
    <h1>EMBERFALL DUEL</h1>
    <p>A duel of embers, tides, leaves and stone. You are the Ember Apprentice.
    Sable, the Ash Warden, holds the far side of the table — and 30 health stands between you.</p>
    <div class="rules">
      <b>How to play</b><br>
      • Each turn you gain a mana crystal and draw a card. Spend mana to play cards from your hand.<br>
      • Creatures take the board and strike on your next turn: click one, then click an enemy creature or Sable.<br>
      • Spells hit at once — Fireball needs a target, Mend and Surge do not.<br>
      • <b>Resonance:</b> the second card of one suit you play in a turn is stronger (+1/+1, or a stronger spell).<br>
      • Reduce Sable to 0 health to win. If you fall to 0, the embers fade.
    </div>
    <div class="suit-key">
      <span>${suitGlyph('flame', SUITS.ember.color)} Ember</span>
      <span>${suitGlyph('drop', SUITS.tide.color)} Tide</span>
      <span>${suitGlyph('leaf', SUITS.leaf.color)} Leaf</span>
      <span>${suitGlyph('mountain', SUITS.stone.color)} Stone</span>
    </div>
    <button class="big-btn" id="btn-play" type="button">Play the duel</button>
    <button class="ghost-btn" id="btn-watch" type="button">Watch them play</button>`;
  overlay.classList.remove('hidden');
  $('btn-play').addEventListener('click', () => onPlay(false));
  $('btn-watch').addEventListener('click', () => onPlay(true));
}

/** The win and loss screens, with the duel's numbers. */
export function showEnd(state, onAgain) {
  const overlay = $('overlay');
  const card = $('overlay-card');
  const summary = duelSummary(state);
  const won = state.winner === 'you';
  card.innerHTML = `
    <span class="big-flame" aria-hidden="true"></span>
    <h1 class="${won ? 'win-title' : 'lose-title'}">${won ? 'VICTORY!' : 'DEFEAT'}</h1>
    <h2>${won ? 'Sable falls — the embers are yours.' : 'The embers fade — Sable keeps the table.'}</h2>
    <p class="score-line">You dealt ${summary.damageDealt} damage over ${summary.turns} turns · ${summary.cardsPlayed} cards played</p>
    <p>${won ? 'The Warden bows, and the table is yours. Play again to defend it.' : 'The Warden keeps the table. Study the suits, chain your Resonance, and challenge Sable again.'}</p>
    <button class="big-btn" id="btn-again" type="button">Play again</button>`;
  overlay.classList.remove('hidden');
  $('btn-again').addEventListener('click', onAgain);
}

/** The short help panel, opened from the top bar. */
export function showHelp(onClose) {
  const overlay = $('overlay');
  const card = $('overlay-card');
  card.innerHTML = `
    <h2>How to play</h2>
    <div class="rules">
      • <b>Your turn:</b> you gain 1 mana crystal (up to 10) and draw a card.<br>
      • <b>Play a card:</b> click it in your hand. Creatures join your board; spells resolve at once.<br>
      • <b>Attack:</b> click one of your ready creatures, then click an enemy creature or Sable's portrait. Creatures cannot attack the turn they are played.<br>
      • <b>Resonance:</b> the second card of the same suit played in one turn is empowered.<br>
      • <b>Win:</b> bring Sable to 0 health. <b>Lose:</b> fall to 0 yourself.<br>
      • <b>Keys:</b> 1–9 plays a hand card · Space ends your turn · Esc cancels a selection · M mutes.
    </div>
    <button class="big-btn" id="btn-close-help" type="button">Back to the table</button>`;
  overlay.classList.remove('hidden');
  $('btn-close-help').addEventListener('click', onClose);
}

/** Hide whatever overlay is showing. */
export function hideOverlay() {
  $('overlay').classList.add('hidden');
}

/** A short floating message, for "not enough mana" and friends. */
export function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add('hidden'), 2200);
}

/** Announce a line to screen readers. */
export function announce(message) {
  $('status').textContent = message;
}
