/**
 * ============================================================
 *  Tic-Tac-Toe — Unit Tests
 * ============================================================
 *  Tests the pure logic functions exported from script.js:
 *    WIN_PATTERNS, getWinner, getEmptyCells, findWinningMove,
 *    minimax, checkResult, state
 *
 *  Run with: npm test
 * ============================================================
 */

/* =============================================================
 *  DOM Mocks
 *  -------------------------------------------------------------
 *  script.js grabs DOM elements at the top level via
 *  document.getElementById / querySelectorAll.  We provide
 *  minimal stubs so the file can be required in Node.
 * ============================================================= */

const mockElement =
{
  classList:     { add: jest.fn(), remove: jest.fn(), contains: jest.fn() },
  setAttribute:  jest.fn(),
  appendChild:   jest.fn(),
  replaceChildren: jest.fn(),
  addEventListener: jest.fn(),
  focus:         jest.fn(),
  textContent:   '',
  className:     '',
  style:         {},
  offsetWidth:   0,
  dataset:       {},
};

/**
 * Creates a fresh mock element so each getElementById call gets
 * its own reference.
 *
 * @returns {Object} A shallow copy of the mock element template
 */
function makeMockElement()
{
  return {
    ...mockElement,
    classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() },
    style:     {},
    dataset:   {},
  };
}

/* Stub out the global `document` APIs script.js needs at load time */
global.document =
{
  getElementById:    jest.fn(() => makeMockElement()),
  querySelectorAll:  jest.fn(() =>
  {
    /* Return 9 mock cells with dataset.index set */
    return Array.from({ length: 9 }, (_, i) =>
    {
      const el = makeMockElement();
      el.dataset = { index: String(i) };
      el.tabIndex = 0;
      return el;
    });
  }),
  activeElement: null,
  addEventListener: jest.fn(),
  createElement:    jest.fn(() => makeMockElement()),
};

/* Stub AudioContext (Web Audio API) */
global.AudioContext = jest.fn(() =>
({
  createOscillator: jest.fn(() =>
  ({
    type:      '',
    frequency: { setValueAtTime: jest.fn() },
    connect:   jest.fn(),
    start:     jest.fn(),
    stop:      jest.fn(),
  })),
  createGain: jest.fn(() =>
  ({
    gain:    { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
    connect: jest.fn(),
  })),
  destination: {},
  currentTime: 0,
}));


/* =============================================================
 *  Import the module under test
 * ============================================================= */

const {
  WIN_PATTERNS,
  getWinner,
  getEmptyCells,
  findWinningMove,
  minimax,
  checkResult,
  state,
} = require('./script.js');


/* =============================================================
 *  Helpers
 * ============================================================= */

/**
 * Resets the board to 9 empty strings and restores default state
 * properties needed by checkResult.
 */
function resetBoard()
{
  state.board         = Array(9).fill('');
  state.currentPlayer = 'X';
  state.gameActive    = true;
  state.playerMark    = 'X';
  state.aiMark        = 'O';
  state.mode          = 'pvp';
  state.inputLocked   = false;
}

/**
 * Fills the board from a compact 9-character string.
 * 'X' → 'X', 'O' → 'O', anything else → '' (empty).
 *
 * @param {string} str - A 9-character board layout, e.g. "XOX OX OX"
 */
function setBoard(str)
{
  for (let i = 0; i < 9; i++)
  {
    const ch = str[i];
    state.board[i] = (ch === 'X' || ch === 'O') ? ch : '';
  }
}


/* =============================================================
 *  Tests — WIN_PATTERNS
 * ============================================================= */

describe('WIN_PATTERNS', () =>
{
  test('should contain exactly 8 winning patterns', () =>
  {
    expect(WIN_PATTERNS).toHaveLength(8);
  });

  test('each pattern should be a 3-element array of indices 0-8', () =>
  {
    for (const pattern of WIN_PATTERNS)
    {
      expect(pattern).toHaveLength(3);
      for (const idx of pattern)
      {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThanOrEqual(8);
      }
    }
  });

  test('should contain all 3 rows', () =>
  {
    expect(WIN_PATTERNS).toContainEqual([0, 1, 2]);
    expect(WIN_PATTERNS).toContainEqual([3, 4, 5]);
    expect(WIN_PATTERNS).toContainEqual([6, 7, 8]);
  });

  test('should contain all 3 columns', () =>
  {
    expect(WIN_PATTERNS).toContainEqual([0, 3, 6]);
    expect(WIN_PATTERNS).toContainEqual([1, 4, 7]);
    expect(WIN_PATTERNS).toContainEqual([2, 5, 8]);
  });

  test('should contain both diagonals', () =>
  {
    expect(WIN_PATTERNS).toContainEqual([0, 4, 8]);
    expect(WIN_PATTERNS).toContainEqual([2, 4, 6]);
  });
});


/* =============================================================
 *  Tests — getWinner
 * ============================================================= */

describe('getWinner', () =>
{
  test('should return null for an empty board', () =>
  {
    const board = Array(9).fill('');
    expect(getWinner(board)).toBeNull();
  });

  test('should detect X winning via top row', () =>
  {
    const board = ['X','X','X', '','O','O', '','',''];
    expect(getWinner(board)).toBe('X');
  });

  test('should detect O winning via middle row', () =>
  {
    const board = ['X','','X', 'O','O','O', '','X',''];
    expect(getWinner(board)).toBe('O');
  });

  test('should detect X winning via left column', () =>
  {
    const board = ['X','O','', 'X','O','', 'X','',''];
    expect(getWinner(board)).toBe('X');
  });

  test('should detect O winning via main diagonal', () =>
  {
    const board = ['O','X','', 'X','O','', '','','O'];
    expect(getWinner(board)).toBe('O');
  });

  test('should detect X winning via anti-diagonal', () =>
  {
    const board = ['','','X', 'O','X','', 'X','O',''];
    expect(getWinner(board)).toBe('X');
  });

  test('should return null when no winner yet', () =>
  {
    const board = ['X','O','', '','X','', '','','O'];
    expect(getWinner(board)).toBeNull();
  });

  test('should return null for a drawn (full) board', () =>
  {
    const board = ['X','O','X', 'X','O','O', 'O','X','X'];
    expect(getWinner(board)).toBeNull();
  });
});


/* =============================================================
 *  Tests — getEmptyCells
 * ============================================================= */

describe('getEmptyCells', () =>
{
  test('should return all 9 indices for an empty board', () =>
  {
    const board = Array(9).fill('');
    expect(getEmptyCells(board)).toEqual([0,1,2,3,4,5,6,7,8]);
  });

  test('should return empty array for a full board', () =>
  {
    const board = ['X','O','X', 'O','X','O', 'O','X','O'];
    expect(getEmptyCells(board)).toEqual([]);
  });

  test('should return only empty positions', () =>
  {
    const board = ['X','','X', '','O','', '','','O'];
    expect(getEmptyCells(board)).toEqual([1,3,5,6,7]);
  });

  test('should return single empty cell', () =>
  {
    const board = ['X','O','X', 'O','X','O', 'O','X',''];
    expect(getEmptyCells(board)).toEqual([8]);
  });
});


/* =============================================================
 *  Tests — findWinningMove
 * ============================================================= */

describe('findWinningMove', () =>
{
  test('should find the winning cell when X has 2-in-a-row', () =>
  {
    const board   = ['X','X','', '','O','', '','','O'];
    const pattern = [0, 1, 2];
    expect(findWinningMove(board, pattern, 'X')).toBe(2);
  });

  test('should find the blocking cell when O has 2-in-a-row', () =>
  {
    const board   = ['O','','O', 'X','X','', '','',''];
    const pattern = [0, 1, 2];
    expect(findWinningMove(board, pattern, 'O')).toBe(1);
  });

  test('should return null when pattern has no 2-of-same-mark', () =>
  {
    const board   = ['X','O','', '','','', '','',''];
    const pattern = [0, 1, 2];
    expect(findWinningMove(board, pattern, 'X')).toBeNull();
  });

  test('should return null for a full pattern', () =>
  {
    const board   = ['X','O','X', '','','', '','',''];
    const pattern = [0, 1, 2];
    expect(findWinningMove(board, pattern, 'X')).toBeNull();
  });

  test('should find vertical winning move', () =>
  {
    const board   = ['O','X','', 'O','','', '','','X'];
    const pattern = [0, 3, 6];
    expect(findWinningMove(board, pattern, 'O')).toBe(6);
  });

  test('should find diagonal winning move', () =>
  {
    const board   = ['X','O','', '','X','', '','',''];
    const pattern = [0, 4, 8];
    expect(findWinningMove(board, pattern, 'X')).toBe(8);
  });
});


/* =============================================================
 *  Tests — checkResult (uses state.board)
 * ============================================================= */

describe('checkResult', () =>
{
  beforeEach(resetBoard);

  test('should return null for an empty board', () =>
  {
    expect(checkResult()).toBeNull();
  });

  test('should detect X win with pattern', () =>
  {
    setBoard('XXX OO   ');
    const result = checkResult();
    expect(result).not.toBeNull();
    expect(result.type).toBe('win');
    expect(result.winner).toBe('X');
    expect(result.pattern).toEqual([0, 1, 2]);
  });

  test('should detect O win via column', () =>
  {
    setBoard('XO  OX O ');
    const result = checkResult();
    expect(result).not.toBeNull();
    expect(result.type).toBe('win');
    expect(result.winner).toBe('O');
    expect(result.pattern).toEqual([1, 4, 7]);
  });

  test('should detect a draw when board is full with no winner', () =>
  {
    setBoard('XOXXOOOXX');
    const result = checkResult();
    expect(result).not.toBeNull();
    expect(result.type).toBe('draw');
  });

  test('should return null for an in-progress game', () =>
  {
    setBoard('XO  X    ');
    expect(checkResult()).toBeNull();
  });

  test('should detect diagonal win', () =>
  {
    setBoard('X  OXO  X');
    const result = checkResult();
    expect(result.type).toBe('win');
    expect(result.winner).toBe('X');
    expect(result.pattern).toEqual([0, 4, 8]);
  });

  test('should detect anti-diagonal win', () =>
  {
    setBoard('X O O O X');
    //        indices: 2, 4, 6 are O
    const result = checkResult();
    expect(result.type).toBe('win');
    expect(result.winner).toBe('O');
    expect(result.pattern).toEqual([2, 4, 6]);
  });
});


/* =============================================================
 *  Tests — minimax
 * ============================================================= */

describe('minimax', () =>
{
  test('should return positive score when AI (X) wins', () =>
  {
    const board = ['X','X','X', 'O','O','', '','',''];
    const score = minimax(board, 0, false, -Infinity, Infinity, 'X', 'O');
    expect(score).toBeGreaterThan(0);
  });

  test('should return negative score when human (O) wins', () =>
  {
    const board = ['O','O','O', 'X','X','', '','',''];
    const score = minimax(board, 0, true, -Infinity, Infinity, 'X', 'O');
    expect(score).toBeLessThan(0);
  });

  test('should return 0 for a drawn board', () =>
  {
    const board = ['X','O','X', 'X','O','O', 'O','X','X'];
    const score = minimax(board, 0, true, -Infinity, Infinity, 'X', 'O');
    expect(score).toBe(0);
  });

  test('should prefer immediate win (higher score at lower depth)', () =>
  {
    /* AI (X) can win now at index 2 */
    const board = ['X','X','', 'O','O','', '','',''];

    /* Score with board one move from AI winning should be high */
    board[2] = 'X';
    const immediateWinScore = minimax(board, 1, false, -Infinity, Infinity, 'X', 'O');
    board[2] = '';

    expect(immediateWinScore).toBeGreaterThan(0);
  });

  test('should correctly evaluate a nearly complete board', () =>
  {
    /* One empty cell — X is about to place and win */
    const board = ['X','O','X', 'O','X','O', 'O','X',''];
    const score = minimax(board, 0, true, -Infinity, Infinity, 'X', 'O');
    /* X takes index 8, wins on [0,4,8] or [2,4,6] — actually X already has 0,4 so placing 8 wins */
    expect(score).toBeGreaterThan(0);
  });
});


/* =============================================================
 *  Tests — Hard AI (minimax) is unbeatable
 *  -------------------------------------------------------------
 *  Plays every possible opening move for X against the hard AI
 *  (playing O) and verifies the AI never loses.
 * ============================================================= */

describe('Hard AI (unbeatable)', () =>
{
  /**
   * Simple recursive game player. Tries every possible move for
   * the current player and checks that the AI never loses.
   *
   * @param {string[]} board   - Current board state
   * @param {string}   current - 'X' (human) or 'O' (AI)
   * @param {string}   ai      - AI's mark
   * @param {string}   human   - Human's mark
   * @returns {boolean} True if AI never lost in this subtree
   */
  function aiNeverLoses(board, current, ai, human)
  {
    const winner = getWinner(board);
    if (winner === human) return false;  // AI lost
    if (winner === ai)    return true;   // AI won
    if (!board.includes('')) return true; // Draw — acceptable

    const empty = getEmptyCells(board);

    if (current === ai)
    {
      /* AI's turn — use minimax to pick the best move */
      let bestScore = -Infinity;
      let bestMove  = null;

      for (const idx of empty)
      {
        board[idx] = ai;
        const score = minimax(board, 0, false, -Infinity, Infinity, ai, human);
        board[idx] = '';

        if (score > bestScore)
        {
          bestScore = score;
          bestMove  = idx;
        }
      }

      board[bestMove] = ai;
      const result = aiNeverLoses(board, human, ai, human);
      board[bestMove] = '';
      return result;
    }
    else
    {
      /* Human's turn — try every possible move */
      for (const idx of empty)
      {
        board[idx] = human;
        const result = aiNeverLoses(board, ai, ai, human);
        board[idx] = '';

        if (!result) return false;  // Found a line where AI loses
      }
      return true;
    }
  }

  test('AI (O) should never lose when human (X) goes first', () =>
  {
    const board = Array(9).fill('');
    expect(aiNeverLoses(board, 'X', 'O', 'X')).toBe(true);
  });

  test('AI (X) should never lose when AI goes first', () =>
  {
    const board = Array(9).fill('');
    expect(aiNeverLoses(board, 'X', 'X', 'O')).toBe(true);
  });
});


/* =============================================================
 *  Tests — findWinningMove integration (Medium AI helpers)
 *  -------------------------------------------------------------
 *  Verifies that scanning all WIN_PATTERNS finds the correct
 *  winning or blocking move.
 * ============================================================= */

describe('findWinningMove across all patterns', () =>
{
  /**
   * Scans all WIN_PATTERNS for a winning move, mirroring
   * the medium AI's behaviour.
   *
   * @param {string[]} board - The 9-element board array
   * @param {string}   mark  - Mark to find a winning move for
   * @returns {number|null} Index of the winning cell, or null
   */
  function findBestWinningMove(board, mark)
  {
    for (const pattern of WIN_PATTERNS)
    {
      const move = findWinningMove(board, pattern, mark);
      if (move !== null) return move;
    }
    return null;
  }

  test('should find winning move for X on bottom row', () =>
  {
    const board = ['O','','', 'O','X','', 'X','','X'];
    expect(findBestWinningMove(board, 'X')).toBe(7);
  });

  test('should find blocking move against O on right column', () =>
  {
    const board = ['','','O', 'X','X','O', '','',''];
    expect(findBestWinningMove(board, 'O')).toBe(8);
  });

  test('should return null when no immediate win/block exists', () =>
  {
    const board = ['X','','', '','O','', '','',''];
    expect(findBestWinningMove(board, 'X')).toBeNull();
    expect(findBestWinningMove(board, 'O')).toBeNull();
  });

  test('should prioritise first found pattern', () =>
  {
    /* X can win on row [0,1,2] at index 0 OR column [0,3,6] at index 0 — both return 0 */
    const board = ['','X','X', 'X','O','', 'X','','O'];
    const move = findBestWinningMove(board, 'X');
    expect(move).toBe(0);
  });
});


/* =============================================================
 *  Tests — Edge cases & state integrity
 * ============================================================= */

describe('Edge cases', () =>
{
  beforeEach(resetBoard);

  test('getWinner should handle board with only one mark', () =>
  {
    const board = ['X','','', '','','', '','',''];
    expect(getWinner(board)).toBeNull();
  });

  test('getEmptyCells should handle board with single empty cell', () =>
  {
    const board = ['X','O','X', 'O','X','O', 'O','X',''];
    expect(getEmptyCells(board)).toEqual([8]);
  });

  test('minimax should not mutate the board', () =>
  {
    const board    = ['X','O','', '', 'X','', '','','O'];
    const snapshot = [...board];

    minimax(board, 0, true, -Infinity, Infinity, 'X', 'O');

    expect(board).toEqual(snapshot);
  });

  test('checkResult should detect all 8 win patterns', () =>
  {
    const winBoards =
    [
      'XXX      ',  // row 1
      '   XXX   ',  // row 2
      '      XXX',  // row 3
      'X  X  X  ',  // col 1
      ' X  X  X ',  // col 2
      '  X  X  X',  // col 3
      'X   X   X',  // diag
      '  X X X  ',  // anti-diag
    ];

    for (const layout of winBoards)
    {
      setBoard(layout);
      const result = checkResult();
      expect(result).not.toBeNull();
      expect(result.type).toBe('win');
      expect(result.winner).toBe('X');
    }
  });

  test('state.board defaults to 9 empty strings', () =>
  {
    resetBoard();
    expect(state.board).toHaveLength(9);
    expect(state.board.every(c => c === '')).toBe(true);
  });
});
