/**
 * ============================================================
 *  Tic-Tac-Toe — Entry Point
 * ============================================================
 *  Creates the shared game state and the three class instances
 *  (UIManager, AudioManager, Game), wires all DOM event listeners,
 *  and exposes module exports for the test suite.
 *
 *  This file is the only place that touches the DOM for event
 *  binding — Game, AudioManager, and UIManager never bind their
 *  own listeners.  This keeps the dependency flow one-directional:
 *
 *    main.ts → Game → AudioManager
 *                   → AIEngine
 *                   → UIManager
 * ============================================================
 */

import type { Difficulty, Player, GameState, BoardCell } from './types';
import { AIEngine } from './ai';
import { AudioManager } from './audio';
import { UIManager } from './ui';
import { Game } from './game';


/* =============================================================
 *  Bootstrap — Create State & Instances
 * ============================================================= */

/**
 * The single shared game state object.
 * Created here so AudioManager can close over `state.muted`
 * without a circular dependency on Game.
 */
const state: GameState =
{
  mode:             null,
  difficulty:       null,
  playerMark:       'X',
  aiMark:           'O',
  currentPlayer:    'X',
  board:            Array(9).fill('') as BoardCell[],
  gameActive:       false,
  scores:           { p1: 0, draws: 0, p2: 0 },
  muted:            false,
  aiThinking:       false,
  aiTimeoutId:      null,
  overlayTimeoutId: null,
  currentScreen:    'menu',
  isTransitioning:  false,
  inputLocked:      false,
};

const ui    = new UIManager();
const audio = new AudioManager(() => state.muted);
const game  = new Game(state, ui, audio);


/* =============================================================
 *  Menu & Navigation Event Listeners
 * ============================================================= */

/* Mode selection — PvP goes straight to game, PvAI enters setup flow */
document.getElementById('btn-pvp')!.addEventListener('click',  () => game.startPvP());
document.getElementById('btn-pvai')!.addEventListener('click', () => game.startPvAI());

/* Difficulty selection — each button carries a data-difficulty attribute */
document.querySelectorAll<HTMLElement>('[data-difficulty]').forEach(btn =>
{
  btn.addEventListener('click', () => game.setDifficulty(btn.dataset.difficulty as Difficulty));
});

/* Side (X / O) selection — each button carries a data-side attribute */
document.querySelectorAll<HTMLElement>('[data-side]').forEach(btn =>
{
  btn.addEventListener('click', () => game.setSide(btn.dataset.side as Player));
});

/* Back buttons — navigate one step up the menu hierarchy */
document.getElementById('btn-back-difficulty')!.addEventListener('click', () => game.navigateBack('difficulty'));
document.getElementById('btn-back-side')!.addEventListener('click',       () => game.navigateBack('side'));

/* Game-over overlay buttons */
document.getElementById('btn-play-again')!.addEventListener('click',  () => game.handlePlayAgain());
document.getElementById('btn-change-mode')!.addEventListener('click', () => game.handleChangeMode());

/* Mute toggle — flips the muted flag and swaps the speaker emoji */
ui.getMuteToggle().addEventListener('click', () => game.toggleMute());


/* =============================================================
 *  Cell Interaction (click + keyboard)
 * ============================================================= */

const cells = ui.getCells();

cells.forEach(cell =>
{
  /* Click handler */
  cell.addEventListener('click', () => game.handleCellAction(Number(cell.dataset.index)));

  /* Keyboard handler — Enter or Space activates the focused cell */
  cell.addEventListener('keydown', (e: KeyboardEvent) =>
  {
    if (e.key === 'Enter' || e.key === ' ')
    {
      e.preventDefault();
      game.handleCellAction(Number(cell.dataset.index));
    }
  });
});


/* =============================================================
 *  Global Keyboard Navigation
 * ============================================================= */

document.addEventListener('keydown', (e: KeyboardEvent) =>
{
  /* Escape key: context-sensitive back navigation */
  if (e.key === 'Escape')
  {
    game.handleEscape();
  }

  /* Arrow keys: move focus between cells on the game board */
  if (state.currentScreen !== 'game') return;

  const focused = document.activeElement as HTMLElement | null;
  if (!focused || !focused.classList.contains('cell')) return;

  const idx = Number(focused.dataset.index);
  let next: number | null = null;

  /* Grid navigation: calculate the target cell index */
  switch (e.key)
  {
    case 'ArrowRight': next = idx % 3 < 2 ? idx + 1 : null; break;  // stop at right edge
    case 'ArrowLeft':  next = idx % 3 > 0 ? idx - 1 : null; break;  // stop at left edge
    case 'ArrowDown':  next = idx < 6 ? idx + 3 : null;     break;  // stop at bottom edge
    case 'ArrowUp':    next = idx > 2 ? idx - 3 : null;     break;  // stop at top edge
  }

  if (next !== null)
  {
    e.preventDefault();
    cells[next].focus();
  }
});


/* =============================================================
 *  Ambient Particles (menu background decoration)
 * ============================================================= */

ui.spawnAmbientParticles();


/* =============================================================
 *  Module Exports (for unit testing)
 *  -----------------------------------------------------------
 *  In a browser context `typeof module` is 'undefined', so this
 *  block is a no-op.  In Node (test runner) it exposes the pure
 *  logic functions and state needed by the test suite.
 *
 *  Static AIEngine methods are bound to preserve `this` context.
 *  Game.checkResult and AudioManager.playTone are wrapped in
 *  closures so tests call them as plain functions.
 * ============================================================= */

if (typeof module !== 'undefined' && module.exports)
{
  module.exports =
  {
    WIN_PATTERNS: AIEngine.WIN_PATTERNS,
    getWinner:       AIEngine.getWinner.bind(AIEngine),
    getEmptyCells:   AIEngine.getEmptyCells.bind(AIEngine),
    findWinningMove: AIEngine.findWinningMove.bind(AIEngine),
    minimax:         AIEngine.minimax.bind(AIEngine),
    checkResult:     () => game.checkResult(),
    state,
    playTone:        (freq: number, duration: number, type?: OscillatorType, volume?: number) => audio.playTone(freq, duration, type, volume),
    _resetAudioCtx:  () => audio._resetAudioCtx(),
  };
}
