/**
 * ============================================================
 *  Tic-Tac-Toe — UI Manager
 * ============================================================
 *  Owns every DOM reference and handles all visual updates.
 *  Contains zero game logic — it receives instructions from
 *  Game and renders them.
 *
 *  Responsibilities:
 *  - Screen transitions (fade-out → swap → fade-in)
 *  - Board cell rendering (marks, highlights, win line)
 *  - Status bar text and colour updates
 *  - Scoreboard with animated "bump" on score change
 *  - Game-over overlay with confetti
 *  - Mute icon toggle
 *  - Ambient menu particles
 * ============================================================
 */

import type { ScreenId, Player, GameMode, GameState, ScoreElements, WinResult, DrawResult } from './types';


/* -------------------------------------------------------------
 *  Constants
 * ------------------------------------------------------------- */

/** Duration of the CSS fade-out transition between screens (ms). */
const SCREEN_TRANSITION_MS = 300;

/** Number of confetti pieces in the main burst. */
const CONFETTI_COUNT  = 80;
/** Number of tiny sparkle/pixie-dust particles after confetti. */
const SPARKLE_COUNT   = 30;
/** Palette for randomly coloured confetti. */
const CONFETTI_COLORS: readonly string[] = ['#0ff', '#f0f', '#ff0', '#0f0', '#f60', '#fff', '#f0f8', '#0ff8'];
/** Possible confetti shapes — CSS-styled via class name. */
const CONFETTI_SHAPES: readonly string[] = ['square', 'circle', 'sliver'];


/**
 * Manages all DOM interactions for the game.
 *
 * On construction, caches references to every DOM element the game
 * needs.  All subsequent reads/writes go through these cached refs
 * for performance and to catch missing elements early.
 */
export class UIManager
{
  /** The four navigable screen containers, keyed by ScreenId. */
  private screens: Record<ScreenId, HTMLElement>;
  /** The full-screen game-over overlay. */
  private overlay: HTMLElement;
  /** The text element inside the overlay ("You Win!", etc.). */
  private overlayMessage: HTMLElement;
  /** Container for confetti and sparkle particles. */
  private confettiContainer: HTMLElement;
  /** The status bar wrapper (carries colour class like 'x-turn'). */
  private statusEl: HTMLElement;
  /** The text span inside the status bar. */
  private statusText: HTMLElement;
  /** The 3x3 board container (used for win-line positioning). */
  private boardEl: HTMLElement;
  /** All 9 cell elements, in order (index 0 = top-left). */
  private cells: HTMLElement[];
  /** Cached scoreboard element references. */
  private scoreEls: ScoreElements;
  /** The mute toggle button. */
  private muteToggle: HTMLElement;
  /** The emoji icon inside the mute button. */
  private muteIcon: HTMLElement;

  /** Grabs and caches all DOM elements the game will need. */
  constructor()
  {
    this.screens =
    {
      menu:       document.getElementById('screen-menu')!,
      difficulty: document.getElementById('screen-difficulty')!,
      side:       document.getElementById('screen-side')!,
      game:       document.getElementById('screen-game')!,
    };

    this.overlay           = document.getElementById('overlay')!;
    this.overlayMessage    = document.getElementById('overlay-message')!;
    this.confettiContainer = document.getElementById('confetti-container')!;
    this.statusEl          = document.getElementById('status')!;
    this.statusText        = document.getElementById('status-text')!;
    this.boardEl           = document.getElementById('board')!;
    this.cells             = Array.from(document.querySelectorAll<HTMLElement>('.cell'));

    this.scoreEls =
    {
      p1:     document.getElementById('score-1')!,
      draws:  document.getElementById('score-draws')!,
      p2:     document.getElementById('score-2')!,
      label1: document.getElementById('score-label-1')!,
      label2: document.getElementById('score-label-2')!,
    };

    this.muteToggle = document.getElementById('mute-toggle')!;
    this.muteIcon   = document.getElementById('mute-icon')!;
  }


  /* =============================================================
   *  Screen Navigation
   * ============================================================= */

  /**
   * Transitions from the currently active screen to another.
   *
   * The current screen fades out (CSS class), then after
   * SCREEN_TRANSITION_MS the classes are swapped and the new
   * screen becomes visible.  Calls `onReady` once the new screen
   * is fully shown — used by Game to trigger `startGame` after
   * navigating to the game screen.
   *
   * Ignores calls if a transition is already in progress
   * (prevents double-clicks from breaking the animation).
   *
   * @param state    - Shared game state (reads/writes currentScreen, isTransitioning).
   * @param screenId - The screen to navigate to.
   * @param onReady  - Optional callback invoked once the new screen is visible.
   */
  showScreen(state: GameState, screenId: ScreenId, onReady?: () => void): void
  {
    if (state.isTransitioning) return;

    const current = this.screens[state.currentScreen];
    const next    = this.screens[screenId];

    /* Already on this screen — just fire the callback */
    if (current === next)
    {
      if (onReady) onReady();
      return;
    }

    state.isTransitioning = true;

    if (current)
    {
      /* Fade out current, then swap */
      current.classList.add('fade-out');
      setTimeout(() =>
      {
        current.classList.remove('active', 'fade-out');
        next.classList.add('active');
        state.currentScreen   = screenId;
        state.isTransitioning = false;
        if (onReady) onReady();
      }, SCREEN_TRANSITION_MS);
    }
    else
    {
      /* No current screen (shouldn't happen normally) — just show next */
      next.classList.add('active');
      state.currentScreen   = screenId;
      state.isTransitioning = false;
      if (onReady) onReady();
    }
  }


  /* =============================================================
   *  Board
   * ============================================================= */

  /**
   * Resets all 9 cells to their initial empty state.
   * Strips mark elements, CSS classes, and ARIA labels.
   * Also removes any leftover win-line from a previous round.
   */
  clearBoard(): void
  {
    this.cells.forEach(cell =>
    {
      cell.className = 'cell';
      cell.replaceChildren();             // remove mark elements

      /* Restore the default ARIA label with row/col position */
      const idx = Number(cell.dataset.index);
      const row = Math.floor(idx / 3) + 1;
      const col = (idx % 3) + 1;
      cell.setAttribute('aria-label', `Row ${row}, Column ${col}, empty`);
    });

    /* Clean up the animated win-line overlay from last round */
    const existingLine = this.boardEl.querySelector('.win-line');
    if (existingLine) existingLine.remove();
  }

  /**
   * Renders a player's mark in the given cell.
   *
   * Adds `taken` (prevents hover) and `pulse` (pop animation) classes,
   * creates a child `div.mark.x` or `div.mark.o` (CSS-drawn via
   * pseudo-elements), and updates the ARIA label for screen readers.
   *
   * @param idx  - Board cell index (0–8).
   * @param mark - The player's mark to render.
   */
  placeMark(idx: number, mark: Player): void
  {
    const cell = this.cells[idx];
    cell.classList.add('taken', 'pulse');

    /* Create the CSS-drawn mark element */
    const markEl = document.createElement('div');
    markEl.className = `mark ${mark.toLowerCase()}`;
    cell.appendChild(markEl);

    /* Update ARIA for screen readers */
    const row = Math.floor(idx / 3) + 1;
    const col = (idx % 3) + 1;
    cell.setAttribute('aria-label', `Row ${row}, Column ${col}, ${mark}`);
  }

  /**
   * Adds the `.winning` glow class to the three cells in the winning line.
   * @param pattern - Array of 3 cell indices from the WinResult.
   */
  highlightWinningCells(pattern: number[]): void
  {
    pattern.forEach(idx => this.cells[idx].classList.add('winning'));
  }

  /**
   * Renders a gradient line across the three winning cells.
   *
   * Calculates the centre points of the first and last winning
   * cells relative to the board element, computes the distance
   * and angle between them, and creates an absolutely-positioned
   * div rotated to connect the two points.
   *
   * @param pattern - Array of 3 cell indices from the WinResult.
   */
  drawWinLine(pattern: number[]): void
  {
    const [a, , c] = pattern;
    const cellA     = this.cells[a];
    const cellC     = this.cells[c];
    const boardRect = this.boardEl.getBoundingClientRect();
    const rectA     = cellA.getBoundingClientRect();
    const rectC     = cellC.getBoundingClientRect();

    /* Centre points of the first and last winning cells (board-relative) */
    const ax = rectA.left + rectA.width  / 2 - boardRect.left;
    const ay = rectA.top  + rectA.height / 2 - boardRect.top;
    const cx = rectC.left + rectC.width  / 2 - boardRect.left;
    const cy = rectC.top  + rectC.height / 2 - boardRect.top;

    /* Distance between centres = line length; atan2 = rotation angle */
    const length = Math.hypot(cx - ax, cy - ay);
    const angle  = Math.atan2(cy - ay, cx - ax) * (180 / Math.PI);

    /* Create and position the line element */
    const line = document.createElement('div');
    line.className             = 'win-line';
    line.style.width           = `${length + 20}px`;   // +20 for overshoot
    line.style.height          = '4px';
    line.style.left            = `${ax - 10}px`;        // -10 centers the overshoot
    line.style.top             = `${ay - 2}px`;          // -2 centers the 4px height
    line.style.transformOrigin = '0 50%';
    line.style.transform       = `rotate(${angle}deg)`;

    this.boardEl.appendChild(line);
  }

  /**
   * Applies a shake animation to all cells (used on draw).
   * Each cell self-cleans the class via a one-shot `animationend` listener.
   */
  shakeCells(): void
  {
    this.cells.forEach(cell =>
    {
      cell.classList.add('shake');
      cell.addEventListener(
        'animationend',
        () => cell.classList.remove('shake'),
        { once: true }
      );
    });
  }

  /**
   * Sets hover-ghost and focus-ring classes on each cell based
   * on whose turn it is and whether the game is active.
   *
   * Removes all player-specific classes first, then re-applies
   * the correct ones only on empty, interactive cells.
   *
   * @param currentPlayer - Whose turn it is (determines colour).
   * @param gameActive    - Whether the round is in progress.
   * @param aiThinking    - Whether the AI delay timer is running.
   */
  updateHoverClasses(currentPlayer: Player, gameActive: boolean, aiThinking: boolean): void
  {
    const hoverClass = currentPlayer === 'X' ? 'x-hover' : 'o-hover';
    const focusClass = currentPlayer === 'X' ? 'x-turn'  : 'o-turn';

    this.cells.forEach(cell =>
    {
      cell.classList.remove('x-hover', 'o-hover', 'x-turn', 'o-turn');

      /* Only add interactive classes to empty cells during active play */
      if (!cell.classList.contains('taken') && gameActive && !aiThinking)
      {
        cell.classList.add(hoverClass, focusClass);
      }
    });
  }

  /**
   * Returns the array of cell DOM elements.
   * Used by main.ts to bind click and keyboard event listeners.
   */
  getCells(): HTMLElement[]
  {
    return this.cells;
  }


  /* =============================================================
   *  Status Bar
   * ============================================================= */

  /**
   * Updates the status bar text and colour to reflect the current game state.
   *
   * Three modes:
   *  1. Game over   → grey "game-over" class, text unchanged (set by Game)
   *  2. AI thinking → animated "AI is thinking..." with dots
   *  3. Normal turn → "Your turn" / "AI's turn" (PvAI) or "X's turn" (PvP)
   *
   * @param gameActive    - Whether the round is in progress.
   * @param aiThinking    - Whether the AI delay timer is running.
   * @param currentPlayer - Whose turn it is.
   * @param mode          - Current game mode (affects label wording).
   * @param playerMark    - The human player's mark (for PvAI labelling).
   */
  updateStatus(gameActive: boolean, aiThinking: boolean, currentPlayer: Player, mode: GameMode | null, playerMark: Player): void
  {
    /* Reset all status classes */
    this.statusEl.className = '';

    if (!gameActive)
    {
      this.statusEl.classList.add('game-over');
      return;
    }

    if (aiThinking)
    {
      this.statusText.innerHTML = 'AI is thinking<span class="thinking-dots"></span>';
      this.statusEl.classList.add(currentPlayer === 'X' ? 'x-turn' : 'o-turn');
      return;
    }

    /* Normal turn indicator */
    const mark = currentPlayer;
    this.statusEl.classList.add(mark === 'X' ? 'x-turn' : 'o-turn');

    if (mode === 'pvai')
    {
      this.statusText.textContent = mark === playerMark ? 'Your turn' : 'AI\'s turn';
    }
    else
    {
      this.statusText.textContent = `${mark}'s turn`;
    }
  }

  /** Sets the status bar to the game-over style (grey, no turn colour). */
  setStatusGameOver(): void
  {
    this.statusEl.className = 'game-over';
  }

  /**
   * Directly sets the status bar text content.
   * Used by Game for end-of-round messages ("You win!", "It's a draw!", etc.).
   */
  setStatusText(text: string): void
  {
    this.statusText.textContent = text;
  }


  /* =============================================================
   *  Scoreboard
   * ============================================================= */

  /**
   * Sets the player name labels above the score columns.
   * @param label1 - Left column label (e.g. "Player X" or "You (X)").
   * @param label2 - Right column label (e.g. "Player O" or "AI (O)").
   */
  setScoreLabels(label1: string, label2: string): void
  {
    this.scoreEls.label1.textContent = label1;
    this.scoreEls.label2.textContent = label2;
  }

  /**
   * Refreshes all three score displays from the given values.
   * Triggers a CSS "bump" animation on any score that increased.
   */
  updateScoreboard(scores: { p1: number; draws: number; p2: number }): void
  {
    this.animateScore(this.scoreEls.p1,    scores.p1);
    this.animateScore(this.scoreEls.draws, scores.draws);
    this.animateScore(this.scoreEls.p2,    scores.p2);
  }

  /**
   * Sets a score element's text and triggers a bump animation if the
   * value increased.  Uses a forced reflow (`void el.offsetWidth`)
   * to restart the CSS animation even if the class was already present.
   */
  private animateScore(el: HTMLElement, value: number): void
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
   *  Game-Over Overlay
   * ============================================================= */

  /**
   * Displays the game-over overlay with the appropriate message,
   * colour class, and confetti (on player wins).
   *
   * In PvAI mode the message is "You Win!" / "AI Wins!".
   * In PvP mode it's "{mark} Wins!".
   * On draw it's "It's a Draw!" with no confetti.
   *
   * Confetti is only spawned on a human victory (both PvP players
   * count as human) — losing to the AI gives no celebration.
   *
   * @param result     - The WinResult or DrawResult from checkResult.
   * @param mode       - Current game mode (affects message text).
   * @param playerMark - The human player's mark (for PvAI labelling).
   */
  showOverlay(result: WinResult | DrawResult, mode: GameMode | null, playerMark: Player): void
  {
    /* Reset from any previous showing */
    this.overlayMessage.className = 'overlay-message';
    this.confettiContainer.replaceChildren();

    if (result.type === 'win')
    {
      const winner = result.winner;

      /* Set message text based on mode */
      if (mode === 'pvai')
      {
        this.overlayMessage.textContent = winner === playerMark ? 'You Win!' : 'AI Wins!';
      }
      else
      {
        this.overlayMessage.textContent = `${winner} Wins!`;
      }

      /* Add X/O colour class for the message */
      this.overlayMessage.classList.add(winner === 'X' ? 'x-win' : 'o-win');

      /* Confetti only on a human victory */
      if (mode === 'pvp' || winner === playerMark)
      {
        this.spawnConfetti();
      }
    }
    else
    {
      this.overlayMessage.textContent = 'It\'s a Draw!';
      this.overlayMessage.classList.add('draw');
    }

    /* Show the overlay and focus the "Play Again" button */
    this.overlay.classList.add('active');
    this.overlay.setAttribute('aria-hidden', 'false');
    document.getElementById('btn-play-again')!.focus();
  }

  /** Hides the game-over overlay and clears any confetti. */
  hideOverlay(): void
  {
    this.overlay.classList.remove('active');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.confettiContainer.replaceChildren();
  }

  /** Returns whether the game-over overlay is currently visible. */
  isOverlayActive(): boolean
  {
    return this.overlay.classList.contains('active');
  }


  /* =============================================================
   *  Mute Icon
   * ============================================================= */

  /**
   * Updates the mute button's emoji icon.
   * @param muted - True shows the muted speaker, false shows the loud speaker.
   */
  updateMuteIcon(muted: boolean): void
  {
    this.muteIcon.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
  }

  /**
   * Returns the mute toggle button element.
   * Used by main.ts to bind the click listener.
   */
  getMuteToggle(): HTMLElement
  {
    return this.muteToggle;
  }


  /* =============================================================
   *  Confetti
   * ============================================================= */

  /**
   * Spawns a celebratory burst of confetti and sparkle particles.
   *
   * Wave 1: 80 randomly sized/coloured confetti pieces with
   * fall + sway CSS animations.
   *
   * Wave 2: 30 tiny sparkle particles with an additional
   * twinkle animation and soft white glow.
   *
   * All animations are pure CSS — zero ongoing JS cost.
   */
  private spawnConfetti(): void
  {
    /* ---- Wave 1: main confetti pieces ---- */
    for (let i = 0; i < CONFETTI_COUNT; i++)
    {
      const piece = document.createElement('div');
      const shape = CONFETTI_SHAPES[Math.floor(Math.random() * CONFETTI_SHAPES.length)];
      piece.className = `confetti-piece ${shape}`;

      /* Slivers are tall and thin; squares/circles are roughly equal */
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

      this.confettiContainer.appendChild(piece);
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

      this.confettiContainer.appendChild(spark);
    }
  }


  /* =============================================================
   *  Ambient Particles (menu background decoration)
   * ============================================================= */

  /**
   * Spawns 25 tiny glowing dots inside the `#ambient-particles`
   * container.  Each particle floats upward and pulses via pure
   * CSS animation — zero ongoing JS cost after creation.
   */
  spawnAmbientParticles(): void
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
}
