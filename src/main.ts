import type { Difficulty, Player, GameState, BoardCell } from './types';
import { AIEngine } from './ai';
import { AudioManager } from './audio';
import { UIManager } from './ui';
import { Game } from './game';


/* =============================================================
 *  Bootstrap
 * ============================================================= */

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

/* Mode selection */
document.getElementById('btn-pvp')!.addEventListener('click',  () => game.startPvP());
document.getElementById('btn-pvai')!.addEventListener('click', () => game.startPvAI());

/* Difficulty selection */
document.querySelectorAll<HTMLElement>('[data-difficulty]').forEach(btn =>
{
  btn.addEventListener('click', () => game.setDifficulty(btn.dataset.difficulty as Difficulty));
});

/* Side (X / O) selection */
document.querySelectorAll<HTMLElement>('[data-side]').forEach(btn =>
{
  btn.addEventListener('click', () => game.setSide(btn.dataset.side as Player));
});

/* Back buttons */
document.getElementById('btn-back-difficulty')!.addEventListener('click', () => game.navigateBack('difficulty'));
document.getElementById('btn-back-side')!.addEventListener('click',       () => game.navigateBack('side'));

/* Game-over overlay buttons */
document.getElementById('btn-play-again')!.addEventListener('click',  () => game.handlePlayAgain());
document.getElementById('btn-change-mode')!.addEventListener('click', () => game.handleChangeMode());

/* Mute toggle */
ui.getMuteToggle().addEventListener('click', () => game.toggleMute());


/* =============================================================
 *  Cell Interaction
 * ============================================================= */

const cells = ui.getCells();

cells.forEach(cell =>
{
  cell.addEventListener('click', () => game.handleCellAction(Number(cell.dataset.index)));

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
 *  Keyboard Navigation
 * ============================================================= */

document.addEventListener('keydown', (e: KeyboardEvent) =>
{
  /* Escape key: back navigation */
  if (e.key === 'Escape')
  {
    game.handleEscape();
  }

  /* Arrow key grid navigation */
  if (state.currentScreen !== 'game') return;

  const focused = document.activeElement as HTMLElement | null;
  if (!focused || !focused.classList.contains('cell')) return;

  const idx = Number(focused.dataset.index);
  let next: number | null = null;

  switch (e.key)
  {
    case 'ArrowRight': next = idx % 3 < 2 ? idx + 1 : null; break;
    case 'ArrowLeft':  next = idx % 3 > 0 ? idx - 1 : null; break;
    case 'ArrowDown':  next = idx < 6 ? idx + 3 : null;     break;
    case 'ArrowUp':    next = idx > 2 ? idx - 3 : null;     break;
  }

  if (next !== null)
  {
    e.preventDefault();
    cells[next].focus();
  }
});


/* =============================================================
 *  Ambient Particles
 * ============================================================= */

ui.spawnAmbientParticles();


/* =============================================================
 *  Module Exports (for unit testing)
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
