type Player = 'X' | 'O';
type Difficulty = 'easy' | 'medium' | 'hard';
type GameMode = 'pvp' | 'pvai';
type ScreenId = 'menu' | 'difficulty' | 'side' | 'game';
type BoardCell = '' | 'X' | 'O';

interface WinResult
{
  type: 'win';
  winner: Player;
  pattern: number[];
}

interface DrawResult
{
  type: 'draw';
}

type GameResult = WinResult | DrawResult | null;

interface GameState
{
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

interface ScoreElements
{
  p1:     HTMLElement;
  draws:  HTMLElement;
  p2:     HTMLElement;
  label1: HTMLElement;
  label2: HTMLElement;
}

declare global
{
  /** Extend Window to include the webkit-prefixed AudioContext */
  interface Window
  {
    webkitAudioContext: typeof AudioContext;
  }

  /** Satisfy strict mode for the CommonJS module guard */
  var module: { exports: Record<string, unknown> };
}

export type { Player, Difficulty, GameMode, ScreenId, BoardCell, WinResult, DrawResult, GameResult, GameState, ScoreElements };
