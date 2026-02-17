/**
 * ============================================================
 *  Tic-Tac-Toe — Shared Type Definitions
 * ============================================================
 *  Central type hub imported by every other module.
 *  Contains all game-domain types, result discriminated unions,
 *  the full GameState interface, and global ambient declarations.
 * ============================================================
 */


/* -------------------------------------------------------------
 *  Primitive Domain Types
 * ------------------------------------------------------------- */

/** A player's mark on the board. */
type Player = 'X' | 'O';

/** AI difficulty levels — easy is random, medium looks one move ahead, hard uses minimax. */
type Difficulty = 'easy' | 'medium' | 'hard';

/** The two supported play modes. */
type GameMode = 'pvp' | 'pvai';

/** Each navigable screen in the single-page app. */
type ScreenId = 'menu' | 'difficulty' | 'side' | 'game';

/** A single cell on the 3x3 board — empty string means unclaimed. */
type BoardCell = '' | 'X' | 'O';


/* -------------------------------------------------------------
 *  Game Result (discriminated union)
 * ------------------------------------------------------------- */

/** Returned by checkResult when a player completes three-in-a-row. */
interface WinResult
{
  type: 'win';
  winner: Player;
  /** The three cell indices that form the winning line. */
  pattern: number[];
}

/** Returned by checkResult when the board is full with no winner. */
interface DrawResult
{
  type: 'draw';
}

/**
 * The outcome of scanning the board after a move:
 * - `WinResult` — someone won
 * - `DrawResult` — board full, nobody won
 * - `null` — game still in progress
 */
type GameResult = WinResult | DrawResult | null;


/* -------------------------------------------------------------
 *  Game State
 * ------------------------------------------------------------- */

/**
 * The single mutable object that represents the entire game session.
 * Created once in `main.ts` and shared (by reference) with Game,
 * UIManager, and AudioManager.
 */
interface GameState
{
  /** Current play mode, or null before the player has chosen. */
  mode:             GameMode | null;
  /** AI difficulty, set during the difficulty-selection screen. */
  difficulty:       Difficulty | null;
  /** The human player's mark (always 'X' in PvP). */
  playerMark:       Player;
  /** The AI's mark, or null in PvP mode. */
  aiMark:           Player | null;
  /** Whose turn it is right now. */
  currentPlayer:    Player;
  /** The 9-cell board — index 0 is top-left, index 8 is bottom-right. */
  board:            BoardCell[];
  /** True while a round is in play; false between rounds. */
  gameActive:       boolean;
  /** Session score counters (p1 = left column, p2 = right column). */
  scores:           { p1: number; draws: number; p2: number };
  /** Whether audio is muted. Checked by AudioManager before every tone. */
  muted:            boolean;
  /** True while the AI is "thinking" (delay timer running). */
  aiThinking:       boolean;
  /** Handle for the pending AI-move setTimeout, so it can be cancelled. */
  aiTimeoutId:      ReturnType<typeof setTimeout> | null;
  /** Handle for the pending game-over overlay setTimeout. */
  overlayTimeoutId: ReturnType<typeof setTimeout> | null;
  /** Which screen is currently visible. */
  currentScreen:    ScreenId;
  /** Lock flag to prevent overlapping screen transitions. */
  isTransitioning:  boolean;
  /** Lock flag to prevent input during mark-placement animation. */
  inputLocked:      boolean;
}


/* -------------------------------------------------------------
 *  DOM Helper Types
 * ------------------------------------------------------------- */

/** Cached references to the five scoreboard DOM elements. */
interface ScoreElements
{
  p1:     HTMLElement;
  draws:  HTMLElement;
  p2:     HTMLElement;
  label1: HTMLElement;
  label2: HTMLElement;
}


/* -------------------------------------------------------------
 *  Global Ambient Declarations
 * ------------------------------------------------------------- */

declare global
{
  /** Extend Window to include the webkit-prefixed AudioContext (Safari). */
  interface Window
  {
    webkitAudioContext: typeof AudioContext;
  }

  /** Satisfy strict mode for the CommonJS module guard in main.ts. */
  var module: { exports: Record<string, unknown> };
}

export type { Player, Difficulty, GameMode, ScreenId, BoardCell, WinResult, DrawResult, GameResult, GameState, ScoreElements };
