/**
 * ============================================================
 *  Tic-Tac-Toe — Game Controller
 * ============================================================
 *  The central orchestrator.  Owns the game state and coordinates
 *  between the AI engine, audio manager, and UI manager.
 *
 *  Responsibilities:
 *  - Menu navigation flow (mode → difficulty → side → game)
 *  - Starting and resetting rounds
 *  - Handling player input (cell clicks / keyboard)
 *  - Scheduling AI turns with a humanising delay
 *  - Checking for wins/draws and triggering end-game sequence
 *  - Score tracking across rounds
 *  - Mute toggling
 *
 *  Game contains zero DOM manipulation — all visual updates are
 *  delegated to UIManager.  All AI decisions are delegated to
 *  AIEngine.  All sounds are delegated to AudioManager.
 * ============================================================
 */

import type { GameState, Difficulty, Player, ScreenId, GameResult, WinResult, DrawResult } from './types';
import { AIEngine } from './ai';
import { AudioManager } from './audio';
import { UIManager } from './ui';


/* -------------------------------------------------------------
 *  Timing Constants
 * ------------------------------------------------------------- */

/** Minimum delay before the AI places its mark (ms). */
const AI_DELAY_MIN_MS      = 400;
/** Random jitter added on top of the minimum AI delay (ms). */
const AI_DELAY_JITTER_MS   = 300;
/** Delay before showing the game-over overlay after a win (ms). */
const WIN_OVERLAY_DELAY_MS = 1200;
/** Delay before showing the game-over overlay after a draw (ms). */
const DRAW_OVERLAY_DELAY_MS = 1000;


/**
 * Orchestrates the entire game lifecycle.
 *
 * Receives the shared GameState, UIManager, and AudioManager
 * at construction time.  All three are created in `main.ts`
 * and wired together there.
 */
export class Game
{
  /**
   * @param state - The shared mutable game state object.
   * @param ui    - Handles all DOM reads and writes.
   * @param audio - Handles all sound effects.
   */
  constructor(
    private state: GameState,
    private ui: UIManager,
    private audio: AudioManager,
  ) {}

  /**
   * Returns the shared game state object.
   * Used by main.ts for event handlers that read state directly
   * (e.g. arrow-key navigation checks `currentScreen`), and by
   * the module-exports block for test access.
   */
  getState(): GameState
  {
    return this.state;
  }


  /* =============================================================
   *  Menu Flow
   * ============================================================= */

  /**
   * Starts a Player-vs-Player game.
   * Resets scores, labels the scoreboard "Player X" / "Player O",
   * and navigates to the game screen.
   */
  startPvP(): void
  {
    this.state.mode       = 'pvp';
    this.state.playerMark = 'X';
    this.state.aiMark     = null;
    this.state.scores     = { p1: 0, draws: 0, p2: 0 };

    this.ui.setScoreLabels('Player X', 'Player O');
    this.ui.updateScoreboard(this.state.scores);
    this.ui.showScreen(this.state, 'game', () => this.startGame());
  }

  /**
   * Begins the Player-vs-AI setup flow.
   * Navigates to the difficulty selection screen.
   */
  startPvAI(): void
  {
    this.state.mode = 'pvai';
    this.ui.showScreen(this.state, 'difficulty');
  }

  /**
   * Records the chosen AI difficulty and advances to side selection.
   * @param difficulty - The player's chosen difficulty level.
   */
  setDifficulty(difficulty: Difficulty): void
  {
    this.state.difficulty = difficulty;
    this.ui.showScreen(this.state, 'side');
  }

  /**
   * Records the player's chosen side (X or O), resets scores,
   * labels the scoreboard accordingly, and starts the game.
   *
   * The AI gets the opposite mark.  If the player chose O,
   * the AI (as X) will move first once `startGame` runs.
   *
   * @param side - The mark the player wants to play as.
   */
  setSide(side: Player): void
  {
    this.state.playerMark = side;
    this.state.aiMark     = side === 'X' ? 'O' : 'X';
    this.state.scores     = { p1: 0, draws: 0, p2: 0 };

    this.ui.setScoreLabels(`You (${this.state.playerMark})`, `AI (${this.state.aiMark})`);
    this.ui.updateScoreboard(this.state.scores);
    this.ui.showScreen(this.state, 'game', () => this.startGame());
  }

  /**
   * Navigates back one screen in the menu hierarchy.
   * Clears pending timers when leaving the game screen.
   * @param from - The screen the player is currently on.
   */
  navigateBack(from: ScreenId): void
  {
    switch (from)
    {
      case 'difficulty':
        this.ui.showScreen(this.state, 'menu');
        break;
      case 'side':
        this.ui.showScreen(this.state, 'difficulty');
        break;
      case 'game':
        this.clearPendingTimers();
        this.ui.showScreen(this.state, 'menu');
        break;
    }
  }


  /* =============================================================
   *  Core Game Loop
   * ============================================================= */

  /**
   * Resets the board and begins a new round.
   *
   * X always goes first.  If the AI is playing as X, it will
   * automatically make the opening move after a short delay
   * (via `scheduleAITurn`).
   */
  startGame(): void
  {
    this.clearPendingTimers();

    /* Reset board and flags */
    this.state.board         = Array(9).fill('');
    this.state.currentPlayer = 'X';
    this.state.gameActive    = true;
    this.state.inputLocked   = false;

    /* Reset the visual board and status indicators */
    this.ui.clearBoard();
    this.ui.updateStatus(this.state.gameActive, this.state.aiThinking, this.state.currentPlayer, this.state.mode, this.state.playerMark);
    this.ui.updateHoverClasses(this.state.currentPlayer, this.state.gameActive, this.state.aiThinking);

    /* If the AI plays X, it moves first */
    if (this.state.mode === 'pvai' && this.state.aiMark === 'X')
    {
      this.scheduleAITurn();
    }
  }

  /**
   * Handles a player's attempt to claim a cell (click or Enter/Space).
   *
   * Guards against invalid actions (game over, cell taken, AI thinking,
   * input locked, wrong turn in AI mode).  On a valid move:
   *  1. Locks input during animation
   *  2. Places the mark (board state + visual + sound)
   *  3. Checks for win/draw → end game if found
   *  4. Otherwise switches player and triggers AI if needed
   *
   * @param cellIndex - Board index (0–8) of the clicked/activated cell.
   */
  handleCellAction(cellIndex: number): void
  {
    /* Guard: ignore invalid actions */
    if (!this.state.gameActive || this.state.board[cellIndex] !== '' || this.state.aiThinking || this.state.inputLocked)
    {
      return;
    }

    /* Guard: in AI mode, only accept clicks on the human's turn */
    if (this.state.mode === 'pvai' && this.state.currentPlayer !== this.state.playerMark)
    {
      return;
    }

    /* Lock input during mark placement animation */
    this.state.inputLocked = true;
    this.placeMark(cellIndex);

    /* Check if the game is over */
    const result = this.checkResult();
    if (result)
    {
      this.endGame(result);
      return;
    }

    /* Hand the turn to the next player */
    this.switchPlayer();
    this.state.inputLocked = false;

    /* Trigger the AI's response after a short delay */
    if (this.state.mode === 'pvai' && this.state.gameActive)
    {
      this.scheduleAITurn();
    }
  }

  /**
   * Handles the Escape key — context-sensitive back navigation.
   *
   * - Overlay visible → close overlay, return to menu
   * - Game screen     → abandon game, return to menu
   * - Side screen     → back to difficulty
   * - Difficulty       → back to menu
   */
  handleEscape(): void
  {
    if (this.ui.isOverlayActive())
    {
      this.ui.hideOverlay();
      this.clearPendingTimers();
      this.ui.showScreen(this.state, 'menu');
    }
    else if (this.state.currentScreen === 'game')
    {
      this.clearPendingTimers();
      this.ui.showScreen(this.state, 'menu');
    }
    else if (this.state.currentScreen === 'side')
    {
      this.ui.showScreen(this.state, 'difficulty');
    }
    else if (this.state.currentScreen === 'difficulty')
    {
      this.ui.showScreen(this.state, 'menu');
    }
  }

  /** Dismisses the game-over overlay and starts a new round. */
  handlePlayAgain(): void
  {
    this.ui.hideOverlay();
    this.startGame();
  }

  /** Dismisses the game-over overlay and returns to the main menu. */
  handleChangeMode(): void
  {
    this.ui.hideOverlay();
    this.clearPendingTimers();
    this.ui.showScreen(this.state, 'menu');
  }

  /** Toggles the mute flag and updates the speaker icon. */
  toggleMute(): void
  {
    this.state.muted = !this.state.muted;
    this.ui.updateMuteIcon(this.state.muted);
  }


  /* =============================================================
   *  Private — AI Turn
   * ============================================================= */

  /**
   * Schedules the AI to make a move after a randomised delay.
   *
   * The delay (400–700 ms) makes the AI feel like it's "thinking"
   * rather than responding instantly.  The timeout ID is stored
   * in state so it can be cancelled if the player navigates away.
   *
   * Once the timer fires:
   *  1. Ask AIEngine for the best move at the current difficulty
   *  2. Place the mark on the board
   *  3. Check for win/draw → end game if found
   *  4. Otherwise switch back to the human player
   */
  private scheduleAITurn(): void
  {
    this.state.aiThinking = true;
    this.ui.updateStatus(this.state.gameActive, this.state.aiThinking, this.state.currentPlayer, this.state.mode, this.state.playerMark);
    this.ui.updateHoverClasses(this.state.currentPlayer, this.state.gameActive, this.state.aiThinking);

    const delay = AI_DELAY_MIN_MS + Math.random() * AI_DELAY_JITTER_MS;
    this.state.aiTimeoutId = setTimeout(() =>
    {
      this.state.aiTimeoutId = null;

      /* Guard: game may have been abandoned during the delay */
      if (!this.state.gameActive) return;

      /* Ask the AI engine for a move */
      const move = AIEngine.chooseMove(this.state.board, this.state.difficulty!, this.state.aiMark!, this.state.playerMark);
      if (move !== null && move !== undefined)
      {
        this.placeMark(move);
      }

      this.state.aiThinking  = false;
      this.state.inputLocked = false;

      /* Check if the AI's move ended the game */
      const result = this.checkResult();
      if (result)
      {
        this.endGame(result);
      }
      else
      {
        /* Hand back to the human player */
        this.switchPlayer();
        this.ui.updateStatus(this.state.gameActive, this.state.aiThinking, this.state.currentPlayer, this.state.mode, this.state.playerMark);
        this.ui.updateHoverClasses(this.state.currentPlayer, this.state.gameActive, this.state.aiThinking);
      }
    }, delay);
  }


  /* =============================================================
   *  Private — Board Operations
   * ============================================================= */

  /**
   * Places the current player's mark at the given board index.
   * Updates the board array, renders the mark in the DOM, and
   * plays the placement sound.
   */
  private placeMark(idx: number): void
  {
    const mark = this.state.currentPlayer;
    this.state.board[idx] = mark;

    this.ui.placeMark(idx, mark);
    this.audio.playPlaceSound(mark);
  }

  /**
   * Switches the active player from X to O (or vice-versa) and
   * refreshes the status bar and hover classes to match.
   */
  private switchPlayer(): void
  {
    this.state.currentPlayer = this.state.currentPlayer === 'X' ? 'O' : 'X';
    this.ui.updateStatus(this.state.gameActive, this.state.aiThinking, this.state.currentPlayer, this.state.mode, this.state.playerMark);
    this.ui.updateHoverClasses(this.state.currentPlayer, this.state.gameActive, this.state.aiThinking);
  }


  /* =============================================================
   *  Result Checking & End Game
   * ============================================================= */

  /**
   * Scans the board for a win or draw.
   *
   * Checks every WIN_PATTERN for three matching marks, then checks
   * for a full board (draw).  Returns null if the game is still
   * in progress.
   *
   * Public (not private) because it's also exposed via module
   * exports for unit testing.
   */
  checkResult(): GameResult
  {
    /* Check every win pattern for three-in-a-row */
    for (const pattern of AIEngine.WIN_PATTERNS)
    {
      const [a, b, c] = pattern;

      if (this.state.board[a] && this.state.board[a] === this.state.board[b] && this.state.board[a] === this.state.board[c])
      {
        return { type: 'win', winner: this.state.board[a] as Player, pattern };
      }
    }

    /* If no empty cells remain, it's a draw */
    if (!this.state.board.includes(''))
    {
      return { type: 'draw' };
    }

    /* Game still in progress */
    return null;
  }

  /**
   * Ends the current round by deactivating the game and
   * dispatching to the win or draw handler.
   */
  private endGame(result: WinResult | DrawResult): void
  {
    this.state.gameActive  = false;
    this.state.inputLocked = true;
    this.ui.setStatusGameOver();

    if (result.type === 'win')
    {
      this.endGameWithWin(result);
    }
    else
    {
      this.endGameWithDraw(result);
    }
  }

  /**
   * Handles a win: highlights the winning cells, draws the win line,
   * updates the score and status text, plays the appropriate sound,
   * and schedules the game-over overlay after a short delay.
   */
  private endGameWithWin(result: WinResult): void
  {
    this.ui.highlightWinningCells(result.pattern);
    this.ui.drawWinLine(result.pattern);
    this.updateWinStatus(result.winner);
    this.ui.updateScoreboard(this.state.scores);

    /* Show the overlay after a delay so the player sees the win animation */
    this.state.overlayTimeoutId = setTimeout(() =>
    {
      this.state.overlayTimeoutId = null;
      this.ui.showOverlay(result, this.state.mode, this.state.playerMark);
    }, WIN_OVERLAY_DELAY_MS);
  }

  /**
   * Sets the status text, increments the correct score counter,
   * and plays the win or loss sound based on who won and what mode.
   */
  private updateWinStatus(winner: Player): void
  {
    if (this.state.mode === 'pvai')
    {
      if (winner === this.state.playerMark)
      {
        this.ui.setStatusText('You win!');
        this.state.scores.p1++;
        this.audio.playWinSound();
      }
      else
      {
        this.ui.setStatusText('AI wins!');
        this.state.scores.p2++;
        this.audio.playLoseSound();
      }
    }
    else
    {
      this.ui.setStatusText(`${winner} wins!`);

      /* In PvP, X is always p1, O is always p2 */
      if (winner === 'X')
      {
        this.state.scores.p1++;
      }
      else
      {
        this.state.scores.p2++;
      }
      this.audio.playWinSound();
    }
  }

  /**
   * Handles a draw: updates score and status text, shakes the cells,
   * plays the draw sound, and schedules the game-over overlay.
   */
  private endGameWithDraw(_result: DrawResult): void
  {
    this.ui.setStatusText('It\'s a draw!');
    this.state.scores.draws++;
    this.ui.updateScoreboard(this.state.scores);
    this.audio.playDrawSound();
    this.ui.shakeCells();

    /* Show the overlay after a slightly shorter delay than wins */
    this.state.overlayTimeoutId = setTimeout(() =>
    {
      this.state.overlayTimeoutId = null;
      this.ui.showOverlay({ type: 'draw' }, this.state.mode, this.state.playerMark);
    }, DRAW_OVERLAY_DELAY_MS);
  }


  /* =============================================================
   *  Private — Timer Management
   * ============================================================= */

  /**
   * Cancels any pending AI move and overlay timers.
   *
   * Called when navigating away from the game screen or starting
   * a new round, to prevent stale callbacks from firing after
   * the context has changed.
   */
  private clearPendingTimers(): void
  {
    if (this.state.aiTimeoutId !== null)
    {
      clearTimeout(this.state.aiTimeoutId);
      this.state.aiTimeoutId = null;
    }

    if (this.state.overlayTimeoutId !== null)
    {
      clearTimeout(this.state.overlayTimeoutId);
      this.state.overlayTimeoutId = null;
    }

    this.state.aiThinking = false;
  }
}
