import type { BoardCell, Player, Difficulty } from './types';


export class AIEngine
{
  static readonly WIN_PATTERNS: readonly number[][] =
  [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8],   // columns
    [0, 4, 8], [2, 4, 6],               // diagonals
  ];

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

  static getEmptyCells(board: BoardCell[]): number[]
  {
    return board.reduce<number[]>((acc, val, idx) =>
    {
      if (val === '') acc.push(idx);
      return acc;
    }, []);
  }

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

  static minimax(board: BoardCell[], depth: number, isMaximizing: boolean, alpha: number, beta: number, ai: Player, human: Player): number
  {
    const winner = AIEngine.getWinner(board);
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
          const score = AIEngine.minimax(board, depth + 1, false, alpha, beta, ai, human);
          board[i] = '';

          best  = Math.max(best, score);
          alpha = Math.max(alpha, score);
          if (beta <= alpha) break;
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
          const score = AIEngine.minimax(board, depth + 1, true, alpha, beta, ai, human);
          board[i] = '';

          best = Math.min(best, score);
          beta = Math.min(beta, score);
          if (beta <= alpha) break;
        }
      }

      return best;
    }
  }

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

  private static easyMove(board: BoardCell[]): number
  {
    const empty = AIEngine.getEmptyCells(board);
    return empty[Math.floor(Math.random() * empty.length)];
  }

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

    /* 3. Otherwise pick at random */
    return AIEngine.easyMove(board);
  }

  private static hardMove(board: BoardCell[], ai: Player, human: Player): number | null
  {
    let bestScore = -Infinity;
    let bestMove: number | null = null;

    const empty = AIEngine.getEmptyCells(board);

    for (const idx of empty)
    {
      board[idx] = ai;
      const score = AIEngine.minimax(board, 0, false, -Infinity, Infinity, ai, human);
      board[idx] = '';

      if (score > bestScore)
      {
        bestScore = score;
        bestMove  = idx;
      }
    }

    return bestMove;
  }
}
