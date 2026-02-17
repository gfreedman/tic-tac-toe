/**
 * ============================================================
 *  Tic-Tac-Toe — Game Logic
 * ============================================================
 *  Vanilla JS game engine supporting PvP and PvAI modes with
 *  three AI difficulty levels (easy / medium / hard-minimax).
 *
 *  Features:
 *  - Screen-based navigation (menu -> difficulty -> side -> game)
 *  - CSS-drawn animated marks
 *  - Session score tracking
 *  - Web Audio API sound effects with mute toggle
 *  - Full keyboard / screen-reader accessibility
 * ============================================================
 */


/* =============================================================
 *  Type Definitions
 * ============================================================= */

type Player = 'X' | 'O';
type Difficulty = 'easy' | 'medium' | 'hard';
type GameMode = 'pvp' | 'pvai';
type ScreenId = 'menu' | 'difficulty' | 'side' | 'game';
type BoardCell = '' | 'X' | 'O';

interface WinResult {
  type: 'win';
  winner: Player;
  pattern: number[];
}

interface DrawResult {
  type: 'draw';
}

type GameResult = WinResult | DrawResult | null;

interface GameState {
  mode:             GameMode | null;
  difficulty:       Difficulty | null;
  playerMark:       Player;
  aiMark:           Player | null;
  currentPlayer:    Player;
  board:            BoardCell[];
  gameActive:       boolean;
  scores:           { p1: number; draws: number; p2: number };
  muted:            boolean;
  aiThinking:       boolean;
  aiTimeoutId:      ReturnType<typeof setTimeout> | null;
  overlayTimeoutId: ReturnType<typeof setTimeout> | null;
  currentScreen:    ScreenId;
  isTransitioning:  boolean;
  inputLocked:      boolean;
}

interface ScoreElements {
  p1:     HTMLElement;
  draws:  HTMLElement;
  p2:     HTMLElement;
  label1: HTMLElement;
  label2: HTMLElement;
}

/** Extend Window to include the webkit-prefixed AudioContext */
interface Window {
  webkitAudioContext: typeof AudioContext;
}

/** Satisfy strict mode for the CommonJS module guard */
declare var module: { exports: Record<string, unknown> };


/* =============================================================
 *  DOM Element References
 * ============================================================= */

const screens: Record<ScreenId, HTMLElement> =
{
  menu:       document.getElementById('screen-menu')!,
  difficulty: document.getElementById('screen-difficulty')!,
  side:       document.getElementById('screen-side')!,
  game:       document.getElementById('screen-game')!,
};

const overlay          = document.getElementById('overlay')!;
const overlayMessage   = document.getElementById('overlay-message')!;
const confettiContainer = document.getElementById('confetti-container')!;
const statusEl         = document.getElementById('status')!;
const statusText       = document.getElementById('status-text')!;
const boardEl          = document.getElementById('board')!;
const cells: HTMLElement[] = Array.from(document.querySelectorAll<HTMLElement>('.cell'));

const scoreEls: ScoreElements =
{
  p1:     document.getElementById('score-1')!,
  draws:  document.getElementById('score-draws')!,
  p2:     document.getElementById('score-2')!,
  label1: document.getElementById('score-label-1')!,
  label2: document.getElementById('score-label-2')!,
};

const muteToggle = document.getElementById('mute-toggle')!;
const muteIcon   = document.getElementById('mute-icon')!;


/* =============================================================
 *  Constants
 * ============================================================= */

/**
 * All possible three-in-a-row winning patterns.
 * Each sub-array contains cell indices for one line.
 */
const WIN_PATTERNS: readonly number[][] =
[
  [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8],   // columns
  [0, 4, 8], [2, 4, 6],               // diagonals
];

/** Named audio frequency constants (Hz). */
const NOTE =
{
  C5:  523,
  E5:  659,
  G5:  784,
  A4:  440,
  X_PLACE: 600,
  LOSE_HI: 400,
  LOSE_LO: 300,
} as const;

const SCREEN_TRANSITION_MS = 300;
const AI_DELAY_MIN_MS      = 400;
const AI_DELAY_JITTER_MS   = 300;
const WIN_OVERLAY_DELAY_MS = 1200;
const DRAW_OVERLAY_DELAY_MS = 1000;


/* =============================================================
 *  Game State
 * ============================================================= */

const state: GameState =
{
  mode:             null,
  difficulty:       null,
  playerMark:       'X',
  aiMark:           'O',
  currentPlayer:    'X',
  board:            Array(9).fill(''),
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


/* =============================================================
 *  Audio  (Web Audio API — no external files)
 * ============================================================= */

let audioCtx: AudioContext | null = null;

/**
 * Returns the shared AudioContext, creating it on first call.
 */
function getAudioCtx(): AudioContext
{
  if (!audioCtx)
  {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Plays a single synthesised tone.
 */
function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.15): void
{
  if (state.muted) return;

  try
  {
    const ctx  = getAudioCtx();
    if (ctx.state === 'suspended') { ctx.resume(); }
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type            = type;
    osc.frequency.value = freq;
    gain.gain.value     = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }
  catch (e)
  {
    console.error('playTone error:', e);
  }
}

/**
 * Plays the mark-placement sound (higher pitch for X, lower for O).
 */
function playPlaceSound(mark: Player): void
{
  playTone(mark === 'X' ? NOTE.X_PLACE : NOTE.A4, 0.12, 'triangle');
}

/**
 * Plays a rising three-note victory jingle (C5 -> E5 -> G5).
 */
function playWinSound(): void
{
  playTone(NOTE.C5, 0.15, 'sine');
  setTimeout(() => playTone(NOTE.E5, 0.15, 'sine'), 100);
  setTimeout(() => playTone(NOTE.G5, 0.3,  'sine'), 200);
}

/**
 * Plays a descending two-note loss sound.
 */
function playLoseSound(): void
{
  playTone(NOTE.LOSE_HI, 0.2,  'sawtooth', 0.1);
  setTimeout(() => playTone(NOTE.LOSE_LO, 0.3, 'sawtooth', 0.1), 150);
}

/**
 * Plays a flat double-beep draw sound.
 */
function playDrawSound(): void
{
  playTone(NOTE.A4, 0.15, 'square', 0.08);
  setTimeout(() => playTone(NOTE.A4, 0.15, 'square', 0.08), 200);
}


/* =============================================================
 *  Timer Management
 * ============================================================= */

/**
 * Cancels any pending AI move and overlay timers.
 * Resets the corresponding state flags.
 */
function clearPendingTimers(): void
{
  if (state.aiTimeoutId !== null)
  {
    clearTimeout(state.aiTimeoutId);
    state.aiTimeoutId = null;
  }

  if (state.overlayTimeoutId !== null)
  {
    clearTimeout(state.overlayTimeoutId);
    state.overlayTimeoutId = null;
  }

  state.aiThinking = false;
}


/* =============================================================
 *  Screen Navigation
 * ============================================================= */

/**
 * Transitions from the currently active screen to another.
 * Ignores calls if a transition is already in progress.
 */
function showScreen(screenId: ScreenId, onReady?: () => void): void
{
  if (state.isTransitioning) return;

  const current = screens[state.currentScreen];
  const next    = screens[screenId];

  if (current === next)
  {
    if (onReady) onReady();
    return;
  }

  state.isTransitioning = true;

  if (current)
  {
    current.classList.add('fade-out');
    setTimeout(() =>
    {
      current.classList.remove('active', 'fade-out');
      next.classList.add('active');
      state.currentScreen    = screenId;
      state.isTransitioning  = false;
      if (onReady) onReady();
    }, SCREEN_TRANSITION_MS);
  }
  else
  {
    next.classList.add('active');
    state.currentScreen    = screenId;
    state.isTransitioning  = false;
    if (onReady) onReady();
  }
}


/* =============================================================
 *  Menu & Navigation Event Listeners
 * ============================================================= */

/* ---- Mode selection ---- */

document.getElementById('btn-pvp')!.addEventListener('click', () =>
{
  state.mode       = 'pvp';
  state.playerMark = 'X';
  state.aiMark     = null;
  state.scores     = { p1: 0, draws: 0, p2: 0 };

  scoreEls.label1.textContent = 'Player X';
  scoreEls.label2.textContent = 'Player O';

  updateScoreboard();
  showScreen('game', startGame);
});

document.getElementById('btn-pvai')!.addEventListener('click', () =>
{
  state.mode = 'pvai';
  showScreen('difficulty');
});

/* ---- Difficulty selection ---- */

document.querySelectorAll<HTMLElement>('[data-difficulty]').forEach(btn =>
{
  btn.addEventListener('click', () =>
  {
    state.difficulty = btn.dataset.difficulty as Difficulty;
    showScreen('side');
  });
});

/* ---- Side (X / O) selection ---- */

document.querySelectorAll<HTMLElement>('[data-side]').forEach(btn =>
{
  btn.addEventListener('click', () =>
  {
    state.playerMark = btn.dataset.side as Player;
    state.aiMark     = state.playerMark === 'X' ? 'O' : 'X';
    state.scores     = { p1: 0, draws: 0, p2: 0 };

    scoreEls.label1.textContent = `You (${state.playerMark})`;
    scoreEls.label2.textContent = `AI (${state.aiMark})`;

    updateScoreboard();
    showScreen('game', startGame);
  });
});

/* ---- Back buttons ---- */

document.getElementById('btn-back-difficulty')!.addEventListener('click', () =>
{
  showScreen('menu');
});

document.getElementById('btn-back-side')!.addEventListener('click', () =>
{
  showScreen('difficulty');
});

/* ---- Game-over overlay buttons ---- */

document.getElementById('btn-play-again')!.addEventListener('click', () =>
{
  hideOverlay();
  startGame();
});

document.getElementById('btn-change-mode')!.addEventListener('click', () =>
{
  hideOverlay();
  clearPendingTimers();
  showScreen('menu');
});

/* ---- Mute toggle ---- */

muteToggle.addEventListener('click', () =>
{
  state.muted = !state.muted;
  muteIcon.textContent = state.muted ? '\u{1F507}' : '\u{1F50A}';
});


/* =============================================================
 *  Core Game Logic
 * ============================================================= */

/**
 * Resets the board and begins a new round.
 * If the AI plays as X it will make the first move after a short delay.
 */
function startGame(): void
{
  clearPendingTimers();

  state.board         = Array(9).fill('');
  state.currentPlayer = 'X';
  state.gameActive    = true;
  state.inputLocked   = false;

  /* Clear every cell's classes, child marks, and aria labels */
  cells.forEach(cell =>
  {
    cell.className = 'cell';
    cell.replaceChildren();

    const idx = Number(cell.dataset.index);
    const row = Math.floor(idx / 3) + 1;
    const col = (idx % 3) + 1;
    cell.setAttribute('aria-label', `Row ${row}, Column ${col}, empty`);
  });

  /* Remove any leftover win line from the previous round */
  const existingLine = boardEl.querySelector('.win-line');
  if (existingLine) existingLine.remove();

  updateStatus();
  updateHoverClasses();

  /* If the AI is X it moves first */
  if (state.mode === 'pvai' && state.aiMark === 'X')
  {
    scheduleAITurn();
  }
}

/**
 * Updates the status bar text and color class to reflect the
 * current game state (turn indicator, thinking, or game-over).
 */
function updateStatus(): void
{
  statusEl.className = '';

  if (!state.gameActive)
  {
    statusEl.classList.add('game-over');
    return;
  }

  if (state.aiThinking)
  {
    statusText.innerHTML = 'AI is thinking<span class="thinking-dots"></span>';
    statusEl.classList.add(state.currentPlayer === 'X' ? 'x-turn' : 'o-turn');
    return;
  }

  const mark = state.currentPlayer;
  statusEl.classList.add(mark === 'X' ? 'x-turn' : 'o-turn');

  if (state.mode === 'pvai')
  {
    statusText.textContent = mark === state.playerMark ? 'Your turn' : 'AI\'s turn';
  }
  else
  {
    statusText.textContent = `${mark}'s turn`;
  }
}

/**
 * Applies the correct hover-ghost and focus-ring classes to every
 * cell based on the current player and game state.
 */
function updateHoverClasses(): void
{
  const hoverClass = state.currentPlayer === 'X' ? 'x-hover' : 'o-hover';
  const focusClass = state.currentPlayer === 'X' ? 'x-turn'  : 'o-turn';

  cells.forEach(cell =>
  {
    cell.classList.remove('x-hover', 'o-hover', 'x-turn', 'o-turn');

    if (!cell.classList.contains('taken') && state.gameActive && !state.aiThinking)
    {
      cell.classList.add(hoverClass, focusClass);
    }
  });
}


/* =============================================================
 *  Cell Interaction
 * ============================================================= */

/* Bind click and keyboard handlers on each cell */
cells.forEach(cell =>
{
  cell.addEventListener('click', () => handleCellAction(cell));

  cell.addEventListener('keydown', (e: KeyboardEvent) =>
  {
    if (e.key === 'Enter' || e.key === ' ')
    {
      e.preventDefault();
      handleCellAction(cell);
    }
  });
});

/**
 * Handles a player's attempt to claim a cell (via click or keyboard).
 * Places the mark, checks for a result, and triggers the AI if needed.
 */
function handleCellAction(cell: HTMLElement): void
{
  const idx = Number(cell.dataset.index);

  /* Ignore if the game is over, cell is taken, AI is thinking, or input is locked */
  if (!state.gameActive || state.board[idx] !== '' || state.aiThinking || state.inputLocked)
  {
    return;
  }

  /* In AI mode, block clicks during the AI's turn */
  if (state.mode === 'pvai' && state.currentPlayer !== state.playerMark)
  {
    return;
  }

  /* Lock input during placement animation */
  state.inputLocked = true;
  placeMark(idx);

  /* Check for a win or draw */
  const result = checkResult();
  if (result)
  {
    endGame(result);
    return;
  }

  /* Hand the turn to the next player */
  switchPlayer();
  state.inputLocked = false;

  /* Trigger the AI's response after a short delay */
  if (state.mode === 'pvai' && state.gameActive)
  {
    scheduleAITurn();
  }
}

/**
 * Schedules the AI to make a move after a randomised delay.
 * Stores the timeout ID so it can be cancelled on reset.
 */
function scheduleAITurn(): void
{
  state.aiThinking = true;
  updateStatus();
  updateHoverClasses();

  const delay = AI_DELAY_MIN_MS + Math.random() * AI_DELAY_JITTER_MS;
  state.aiTimeoutId = setTimeout(() =>
  {
    state.aiTimeoutId = null;

    if (!state.gameActive) return;

    makeAIMove();
    state.aiThinking  = false;
    state.inputLocked = false;

    const result = checkResult();
    if (result)
    {
      endGame(result);
    }
    else
    {
      switchPlayer();
      updateStatus();
      updateHoverClasses();
    }
  }, delay);
}

/**
 * Places a mark on the board at the given index.
 * Updates the board state, creates the CSS-drawn mark element,
 * refreshes the ARIA label, and plays a sound.
 */
function placeMark(idx: number): void
{
  const mark = state.currentPlayer;
  state.board[idx] = mark;

  const cell = cells[idx];
  cell.classList.add('taken', 'pulse');

  /* Append the CSS-drawn mark (div.mark.x or div.mark.o) */
  const markEl = document.createElement('div');
  markEl.className = `mark ${mark.toLowerCase()}`;
  cell.appendChild(markEl);

  /* Update the ARIA label for screen readers */
  const row = Math.floor(idx / 3) + 1;
  const col = (idx % 3) + 1;
  cell.setAttribute('aria-label', `Row ${row}, Column ${col}, ${mark}`);

  playPlaceSound(mark);
}

/**
 * Switches the current player from X to O or vice-versa,
 * then refreshes the status bar and hover classes.
 */
function switchPlayer(): void
{
  state.currentPlayer = state.currentPlayer === 'X' ? 'O' : 'X';
  updateStatus();
  updateHoverClasses();
}

/**
 * Scans the board for a win or draw.
 */
function checkResult(): GameResult
{
  for (const pattern of WIN_PATTERNS)
  {
    const [a, b, c] = pattern;

    if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c])
    {
      return { type: 'win', winner: state.board[a] as Player, pattern };
    }
  }

  if (!state.board.includes(''))
  {
    return { type: 'draw' };
  }

  return null;
}

/**
 * Ends the current round by updating scores, playing sounds,
 * animating the board, and scheduling the game-over overlay.
 */
function endGame(result: WinResult | DrawResult): void
{
  state.gameActive  = false;
  state.inputLocked = true;
  statusEl.className = 'game-over';

  if (result.type === 'win')
  {
    const winner = result.winner;
    highlightWinningCells(result.pattern);
    drawWinLine(result.pattern);

    if (state.mode === 'pvai')
    {
      if (winner === state.playerMark)
      {
        statusText.textContent = 'You win!';
        state.scores.p1++;
        playWinSound();
      }
      else
      {
        statusText.textContent = 'AI wins!';
        state.scores.p2++;
        playLoseSound();
      }
    }
    else
    {
      statusText.textContent = `${winner} wins!`;

      if (winner === 'X')
      {
        state.scores.p1++;
      }
      else
      {
        state.scores.p2++;
      }
      playWinSound();
    }

    updateScoreboard();

    /* Show the overlay after the win animations have played */
    state.overlayTimeoutId = setTimeout(() =>
    {
      state.overlayTimeoutId = null;
      showOverlay(result);
    }, WIN_OVERLAY_DELAY_MS);
  }
  else
  {
    /* Draw */
    statusText.textContent = 'It\'s a draw!';
    state.scores.draws++;
    updateScoreboard();
    playDrawSound();

    /* Shake every cell briefly */
    cells.forEach(cell =>
    {
      cell.classList.add('shake');
      cell.addEventListener(
        'animationend',
        () => cell.classList.remove('shake'),
        { once: true }
      );
    });

    state.overlayTimeoutId = setTimeout(() =>
    {
      state.overlayTimeoutId = null;
      showOverlay(result);
    }, DRAW_OVERLAY_DELAY_MS);
  }
}

/**
 * Adds the `.winning` glow class to the three winning cells.
 */
function highlightWinningCells(pattern: number[]): void
{
  pattern.forEach(idx => cells[idx].classList.add('winning'));
}

/**
 * Renders a gradient line across the three winning cells.
 * Calculates position and angle from the first and last cell
 * in the winning pattern relative to the board element.
 */
function drawWinLine(pattern: number[]): void
{
  const [a, , c] = pattern;
  const cellA     = cells[a];
  const cellC     = cells[c];
  const boardRect = boardEl.getBoundingClientRect();
  const rectA     = cellA.getBoundingClientRect();
  const rectC     = cellC.getBoundingClientRect();

  /* Centre points of the first and last winning cells (board-relative) */
  const ax = rectA.left + rectA.width  / 2 - boardRect.left;
  const ay = rectA.top  + rectA.height / 2 - boardRect.top;
  const cx = rectC.left + rectC.width  / 2 - boardRect.left;
  const cy = rectC.top  + rectC.height / 2 - boardRect.top;

  const length = Math.hypot(cx - ax, cy - ay);
  const angle  = Math.atan2(cy - ay, cx - ax) * (180 / Math.PI);

  const line = document.createElement('div');
  line.className             = 'win-line';
  line.style.width           = `${length + 20}px`;
  line.style.height          = '4px';
  line.style.left            = `${ax - 10}px`;
  line.style.top             = `${ay - 2}px`;
  line.style.transformOrigin = '0 50%';
  line.style.transform       = `rotate(${angle}deg)`;

  boardEl.appendChild(line);
}


/* =============================================================
 *  Game-Over Overlay
 * ============================================================= */

/**
 * Displays the game-over overlay with the appropriate message,
 * colour class, and confetti (on player wins).
 */
function showOverlay(result: WinResult | DrawResult): void
{
  overlayMessage.className = 'overlay-message';
  confettiContainer.replaceChildren();

  if (result.type === 'win')
  {
    const winner = result.winner;

    if (state.mode === 'pvai')
    {
      overlayMessage.textContent = winner === state.playerMark ? 'You Win!' : 'AI Wins!';
    }
    else
    {
      overlayMessage.textContent = `${winner} Wins!`;
    }

    overlayMessage.classList.add(winner === 'X' ? 'x-win' : 'o-win');

    /* Confetti only on a human victory */
    if (state.mode === 'pvp' || winner === state.playerMark)
    {
      spawnConfetti();
    }
  }
  else
  {
    overlayMessage.textContent = 'It\'s a Draw!';
    overlayMessage.classList.add('draw');
  }

  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  document.getElementById('btn-play-again')!.focus();
}

/**
 * Hides the game-over overlay and clears confetti.
 */
function hideOverlay(): void
{
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  confettiContainer.replaceChildren();
}

const CONFETTI_COUNT = 80;
const SPARKLE_COUNT  = 30;
const CONFETTI_COLORS: readonly string[] = ['#0ff', '#f0f', '#ff0', '#0f0', '#f60', '#fff', '#f0f8', '#0ff8'];
const CONFETTI_SHAPES: readonly string[] = ['square', 'circle', 'sliver'];

/**
 * Spawns a celebratory burst of confetti and sparkle particles.
 */
function spawnConfetti(): void
{
  /* ---- Wave 1: main confetti pieces ---- */
  for (let i = 0; i < CONFETTI_COUNT; i++)
  {
    const piece = document.createElement('div');
    const shape = CONFETTI_SHAPES[Math.floor(Math.random() * CONFETTI_SHAPES.length)];
    piece.className = `confetti-piece ${shape}`;

    const size = shape === 'sliver'
      ? { w: 3 + Math.random() * 4, h: 8 + Math.random() * 14 }
      : { w: 6 + Math.random() * 10, h: 6 + Math.random() * 10 };

    piece.style.left              = `${Math.random() * 100}%`;
    piece.style.background        = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.width             = `${size.w}px`;
    piece.style.height            = `${size.h}px`;
    piece.style.setProperty('--sway', `${10 + Math.random() * 30}px`);
    piece.style.animationDuration = `${1.5 + Math.random() * 2.5}s, ${0.6 + Math.random() * 1}s`;
    piece.style.animationDelay    = `${Math.random() * 0.8}s, ${Math.random() * 0.5}s`;

    confettiContainer.appendChild(piece);
  }

  /* ---- Wave 2: sparkle / pixie dust ---- */
  for (let i = 0; i < SPARKLE_COUNT; i++)
  {
    const spark = document.createElement('div');
    spark.className = 'confetti-piece sparkle';

    const sz = 2 + Math.random() * 3;

    spark.style.left              = `${Math.random() * 100}%`;
    spark.style.background        = '#fff';
    spark.style.width             = `${sz}px`;
    spark.style.height            = `${sz}px`;
    spark.style.boxShadow         = `0 0 ${3 + Math.random() * 6}px #fff`;
    spark.style.setProperty('--sway', `${5 + Math.random() * 20}px`);
    spark.style.animationDuration = `${2 + Math.random() * 2}s, ${0.5 + Math.random() * 0.8}s, ${0.2 + Math.random() * 0.4}s`;
    spark.style.animationDelay    = `${Math.random() * 1.2}s, ${Math.random() * 0.5}s, 0s`;

    confettiContainer.appendChild(spark);
  }
}


/* =============================================================
 *  Scoreboard
 * ============================================================= */

/**
 * Refreshes all three scoreboard values (P1, draws, P2)
 * from the current game state.
 */
function updateScoreboard(): void
{
  animateScore(scoreEls.p1,    state.scores.p1);
  animateScore(scoreEls.draws, state.scores.draws);
  animateScore(scoreEls.p2,    state.scores.p2);
}

/**
 * Sets a score element's text and triggers a bump animation
 * if the value increased.
 */
function animateScore(el: HTMLElement, value: number): void
{
  const prev = Number(el.textContent);
  el.textContent = String(value);

  if (value > prev)
  {
    el.classList.remove('bump');
    void el.offsetWidth;          // force reflow to restart animation
    el.classList.add('bump');
  }
}


/* =============================================================
 *  AI Logic
 * ============================================================= */

/**
 * Selects and executes an AI move based on the current difficulty.
 */
function makeAIMove(): void
{
  let move: number | null | undefined;

  switch (state.difficulty)
  {
    case 'easy':
      move = aiEasy();
      break;
    case 'medium':
      move = aiMedium();
      break;
    case 'hard':
      move = aiHard();
      break;
    default:
      move = aiEasy();
  }

  if (move !== undefined && move !== null)
  {
    placeMark(move);
  }
}

/**
 * Returns an array of indices for all empty cells on the board.
 */
function getEmptyCells(board: BoardCell[]): number[]
{
  return board.reduce<number[]>((acc, val, idx) =>
  {
    if (val === '') acc.push(idx);
    return acc;
  }, []);
}

/**
 * Easy AI — picks a random empty cell.
 */
function aiEasy(): number
{
  const empty = getEmptyCells(state.board);
  return empty[Math.floor(Math.random() * empty.length)];
}

/**
 * Medium AI — checks for an immediate win, then blocks the
 * opponent's immediate win, and falls back to a random move.
 */
function aiMedium(): number
{
  const ai    = state.aiMark!;
  const human = state.playerMark;

  /* 1. Try to win in one move */
  for (const pattern of WIN_PATTERNS)
  {
    const move = findWinningMove(state.board, pattern, ai);
    if (move !== null) return move;
  }

  /* 2. Block the opponent from winning in one move */
  for (const pattern of WIN_PATTERNS)
  {
    const move = findWinningMove(state.board, pattern, human);
    if (move !== null) return move;
  }

  /* 3. Otherwise pick at random */
  return aiEasy();
}

/**
 * Checks whether a specific winning pattern has two marks of
 * the given type plus one empty cell (i.e. one move to win/lose).
 */
function findWinningMove(board: BoardCell[], pattern: readonly number[], mark: Player): number | null
{
  const values     = pattern.map(i => board[i]);
  const markCount  = values.filter(v => v === mark).length;
  const emptyCount = values.filter(v => v === '').length;

  if (markCount === 2 && emptyCount === 1)
  {
    return pattern[values.indexOf('')];
  }
  return null;
}

/**
 * Hard AI — uses the minimax algorithm with alpha-beta pruning
 * to find the optimal move.  Always plays perfectly; the best
 * a human can achieve is a draw.
 */
function aiHard(): number | null
{
  const ai    = state.aiMark!;
  const human = state.playerMark;
  let bestScore = -Infinity;
  let bestMove: number | null  = null;

  const empty = getEmptyCells(state.board);

  for (const idx of empty)
  {
    state.board[idx] = ai;
    const score = minimax(state.board, 0, false, -Infinity, Infinity, ai, human);
    state.board[idx] = '';

    if (score > bestScore)
    {
      bestScore = score;
      bestMove  = idx;
    }
  }

  return bestMove;
}

/**
 * Recursive minimax with alpha-beta pruning.
 *
 * Scores are relative to the AI:
 *   AI win    -> positive (10 - depth)
 *   Human win -> negative (depth - 10)
 *   Draw      -> 0
 */
function minimax(board: BoardCell[], depth: number, isMaximizing: boolean, alpha: number, beta: number, ai: Player, human: Player): number
{
  const winner = getWinner(board);
  if (winner === ai)    return 10 - depth;
  if (winner === human) return depth - 10;
  if (!board.includes('')) return 0;

  if (isMaximizing)
  {
    let best = -Infinity;

    for (let i = 0; i < 9; i++)
    {
      if (board[i] === '')
      {
        board[i] = ai;
        const score = minimax(board, depth + 1, false, alpha, beta, ai, human);
        board[i] = '';

        best  = Math.max(best, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;   // beta cutoff
      }
    }

    return best;
  }
  else
  {
    let best = Infinity;

    for (let i = 0; i < 9; i++)
    {
      if (board[i] === '')
      {
        board[i] = human;
        const score = minimax(board, depth + 1, true, alpha, beta, ai, human);
        board[i] = '';

        best = Math.min(best, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;   // alpha cutoff
      }
    }

    return best;
  }
}

/**
 * Scans the board for a completed three-in-a-row.
 */
function getWinner(board: BoardCell[]): Player | null
{
  for (const [a, b, c] of WIN_PATTERNS)
  {
    if (board[a] && board[a] === board[b] && board[a] === board[c])
    {
      return board[a] as Player;
    }
  }
  return null;
}


/* =============================================================
 *  Keyboard Navigation
 * ============================================================= */

document.addEventListener('keydown', (e: KeyboardEvent) =>
{
  /* ---- Escape key: back navigation ---- */
  if (e.key === 'Escape')
  {
    if (overlay.classList.contains('active'))
    {
      hideOverlay();
      clearPendingTimers();
      showScreen('menu');
    }
    else if (state.currentScreen === 'game')
    {
      clearPendingTimers();
      showScreen('menu');
    }
    else if (state.currentScreen === 'side')
    {
      showScreen('difficulty');
    }
    else if (state.currentScreen === 'difficulty')
    {
      showScreen('menu');
    }
  }

  /* ---- Arrow key grid navigation ---- */
  if (state.currentScreen !== 'game') return;

  const focused = document.activeElement as HTMLElement | null;
  if (!focused || !focused.classList.contains('cell')) return;

  const idx = Number(focused.dataset.index);
  let next: number | null  = null;

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
 *  Ambient Particles  (menu background decoration)
 * ============================================================= */

/**
 * Spawns 25 tiny glowing dots inside the #ambient-particles
 * container.  Each particle floats upward via pure CSS animation
 * — zero ongoing JS cost after creation.
 */
function spawnAmbientParticles(): void
{
  const container = document.getElementById('ambient-particles');
  if (!container) return;

  const colors = ['#0ff', '#f0f', '#fff'];

  for (let i = 0; i < 25; i++)
  {
    const dot = document.createElement('div');
    dot.className = 'ambient-dot';

    const size = 2 + Math.random() * 2;

    dot.style.width  = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left   = `${Math.random() * 100}%`;
    dot.style.bottom = `${Math.random() * 100}%`;
    dot.style.background = colors[Math.floor(Math.random() * colors.length)];
    dot.style.animationDuration = `${8 + Math.random() * 12}s, ${2 + Math.random() * 3}s`;
    dot.style.animationDelay    = `${Math.random() * 10}s, ${Math.random() * 2}s`;

    container.appendChild(dot);
  }
}

spawnAmbientParticles();


/* =============================================================
 *  Module Exports (for unit testing)
 *  -------------------------------------------------------------
 *  In a browser context `typeof module` is 'undefined', so this
 *  block is a no-op.  In Node / test runners it exposes the pure
 *  logic functions.
 * ============================================================= */

if (typeof module !== 'undefined' && module.exports)
{
  module.exports =
  {
    WIN_PATTERNS,
    getWinner,
    getEmptyCells,
    findWinningMove,
    minimax,
    checkResult,
    state,
    playTone,
    _resetAudioCtx() { audioCtx = null; },
  };
}
