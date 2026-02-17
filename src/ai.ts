/**
 * ============================================================
 *  Tic-Tac-Toe — AI Engine
 * ============================================================
 *  Pure game-theory logic with zero DOM or state dependencies.
 *  All methods are static — the class is used purely as a
 *  namespace.
 *
 *  Three difficulty strategies:
 *    easy   — random empty cell
 *    medium — win-if-possible, block-if-needed, else random
 *    hard   — optimal play via minimax with alpha-beta pruning
 *
 *  The hard AI is provably unbeatable: the best a perfect
 *  opponent can achieve is a draw.  There are exhaustive tests
 *  that verify this by exploring the entire game tree.
 * ============================================================
 */

import type { BoardCell, Player, Difficulty } from './types';


/**
 * Static-only class encapsulating all AI logic and board-analysis
 * utilities.  Stateless — every method receives the board as an
 * argument and returns a result without side effects.
 */
export class AIEngine
{
  /**
   * All eight possible three-in-a-row patterns.
   * Each sub-array holds the cell indices for one line.
   * Layout:  0 | 1 | 2
   *          ---------
   *          3 | 4 | 5
   *          ---------
   *          6 | 7 | 8
   */
  static readonly WIN_PATTERNS: readonly number[][] =
  [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8],   // columns
    [0, 4, 8], [2, 4, 6],               // diagonals
  ];

  /**
   * Scans the board for a completed three-in-a-row.
   * @param board - The 9-element board array.
   * @returns The winning player's mark, or null if no winner.
   */
  static getWinner(board: BoardCell[]): Player | null
  {
    for (const [a, b, c] of AIEngine.WIN_PATTERNS)
    {
      if (board[a] && board[a] === board[b] && board[a] === board[c])
      {
        return board[a] as Player;
      }
    }
    return null;
  }

  /**
   * Returns the indices of all empty cells on the board.
   * @param board - The 9-element board array.
   * @returns Array of indices where `board[i] === ''`.
   */
  static getEmptyCells(board: BoardCell[]): number[]
  {
    return board.reduce<number[]>((acc, val, idx) =>
    {
      if (val === '') acc.push(idx);
      return acc;
    }, []);
  }

  /**
   * Checks whether a single winning pattern has exactly two marks
   * of the given type plus one empty cell (i.e. one move away from
   * completing or blocking a line).
   *
   * @param board   - The 9-element board array.
   * @param pattern - A 3-index WIN_PATTERN to inspect.
   * @param mark    - The mark to look for ('X' or 'O').
   * @returns The index of the empty cell that completes the line, or null.
   */
  static findWinningMove(board: BoardCell[], pattern: readonly number[], mark: Player): number | null
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
   * Recursive minimax with alpha-beta pruning.
   *
   * Scores are relative to the AI:
   *   AI win    → positive (10 − depth)  — prefer faster wins
   *   Human win → negative (depth − 10)  — prefer slower losses
   *   Draw      → 0
   *
   * The board is mutated in-place during recursion and restored
   * on backtrack, so callers get the same board back.
   *
   * @param board        - The 9-element board array (mutated then restored).
   * @param depth        - Current recursion depth (starts at 0).
   * @param isMaximizing - True when it's the AI's turn (wants highest score).
   * @param alpha        - Best score the maximizer can guarantee so far.
   * @param beta         - Best score the minimizer can guarantee so far.
   * @param ai           - The AI's mark.
   * @param human        - The human's mark.
   * @returns Heuristic score for this board position.
   */
  static minimax(board: BoardCell[], depth: number, isMaximizing: boolean, alpha: number, beta: number, ai: Player, human: Player): number
  {
    /* --- Base cases: terminal board states --- */
    const winner = AIEngine.getWinner(board);
    if (winner === ai)    return 10 - depth;
    if (winner === human) return depth - 10;
    if (!board.includes('')) return 0;   // draw

    if (isMaximizing)
    {
      /* AI's turn — maximize score */
      let best = -Infinity;

      for (let i = 0; i < 9; i++)
      {
        if (board[i] === '')
        {
          board[i] = ai;
          const score = AIEngine.minimax(board, depth + 1, false, alpha, beta, ai, human);
          board[i] = '';   // undo

          best  = Math.max(best, score);
          alpha = Math.max(alpha, score);
          if (beta <= alpha) break;   // beta cutoff — minimizer won't allow this
        }
      }

      return best;
    }
    else
    {
      /* Human's turn — minimize score */
      let best = Infinity;

      for (let i = 0; i < 9; i++)
      {
        if (board[i] === '')
        {
          board[i] = human;
          const score = AIEngine.minimax(board, depth + 1, true, alpha, beta, ai, human);
          board[i] = '';   // undo

          best = Math.min(best, score);
          beta = Math.min(beta, score);
          if (beta <= alpha) break;   // alpha cutoff — maximizer won't allow this
        }
      }

      return best;
    }
  }

  /**
   * Public entry point: selects an AI move based on the given difficulty.
   *
   * @param board      - The current 9-element board.
   * @param difficulty - Which strategy to use.
   * @param aiMark     - The AI's mark.
   * @param playerMark - The human's mark.
   * @returns The chosen cell index, or null if no move is possible.
   */
  static chooseMove(board: BoardCell[], difficulty: Difficulty, aiMark: Player, playerMark: Player): number | null
  {
    switch (difficulty)
    {
      case 'easy':   return AIEngine.easyMove(board);
      case 'medium': return AIEngine.mediumMove(board, aiMark, playerMark);
      case 'hard':   return AIEngine.hardMove(board, aiMark, playerMark);
      default:       return AIEngine.easyMove(board);
    }
  }

  /**
   * Easy AI — picks a random empty cell.
   * Provides a casual, beatable opponent.
   */
  private static easyMove(board: BoardCell[]): number
  {
    const empty = AIEngine.getEmptyCells(board);
    return empty[Math.floor(Math.random() * empty.length)];
  }

  /**
   * Medium AI — uses a simple three-priority heuristic:
   *   1. Win immediately if possible
   *   2. Block the opponent's immediate win
   *   3. Otherwise pick a random empty cell
   *
   * Stronger than easy but still beatable by an attentive player.
   */
  private static mediumMove(board: BoardCell[], ai: Player, human: Player): number
  {
    /* 1. Try to win in one move */
    for (const pattern of AIEngine.WIN_PATTERNS)
    {
      const move = AIEngine.findWinningMove(board, pattern, ai);
      if (move !== null) return move;
    }

    /* 2. Block the opponent from winning in one move */
    for (const pattern of AIEngine.WIN_PATTERNS)
    {
      const move = AIEngine.findWinningMove(board, pattern, human);
      if (move !== null) return move;
    }

    /* 3. No urgent move — pick at random */
    return AIEngine.easyMove(board);
  }

  /**
   * Hard AI — evaluates every legal move with minimax and picks
   * the one with the highest score.  Always plays optimally;
   * the best a human can achieve is a draw.
   */
  private static hardMove(board: BoardCell[], ai: Player, human: Player): number | null
  {
    let bestScore = -Infinity;
    let bestMove: number | null = null;

    const empty = AIEngine.getEmptyCells(board);

    for (const idx of empty)
    {
      board[idx] = ai;
      const score = AIEngine.minimax(board, 0, false, -Infinity, Infinity, ai, human);
      board[idx] = '';   // undo

      if (score > bestScore)
      {
        bestScore = score;
        bestMove  = idx;
      }
    }

    return bestMove;
  }
}
