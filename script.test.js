/**
 * ============================================================
 *  Tic-Tac-Toe — Unit Tests
 * ============================================================
 *  Tests the pure logic functions exported from test-exports.js:
 *    WIN_PATTERNS, getWinner, getEmptyCells, findWinningMove,
 *    minimax, checkResult, makeAudioManager
 *
 *  Run with: npm test
 * ============================================================
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');


/* =============================================================
 *  DOM Mocks
 *  -------------------------------------------------------------
 *  test-exports.ts pulls in AudioManager which references
 *  window.AudioContext at call time (not load time), so we only
 *  need a minimal global.window stub here.
 * ============================================================= */

function makeMockElement()
{
  return {
    classList:        { add() {}, remove() {}, contains() { return false; } },
    setAttribute()   {},
    appendChild()    {},
    replaceChildren() {},
    addEventListener() {},
    focus()          {},
    textContent:     '',
    className:       '',
    style:           {},
    offsetWidth:     0,
    dataset:         {},
  };
}

global.document =
{
  getElementById()   { return makeMockElement(); },
  querySelectorAll()
  {
    return Array.from({ length: 9 }, (_, i) =>
    {
      const el   = makeMockElement();
      el.dataset = { index: String(i) };
      el.tabIndex = 0;
      return el;
    });
  },
  activeElement:     null,
  addEventListener() {},
  createElement()    { return makeMockElement(); },
};

global.window = global;

/* Default AudioContext stub (overridden per-test in the Audio suite). */
global.AudioContext = function ()
{
  return {
    createOscillator()
    {
      return {
        type:      '',
        frequency: { value: 0 },
        connect()  {},
        start()    {},
        stop()     {},
      };
    },
    createGain()
    {
      return {
        gain: { value: 0, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    },
    destination: {},
    currentTime: 0,
    state: 'running',
    resume() { return Promise.resolve(); },
  };
};


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
  makeAudioManager,
} = require('./dist/test-exports.js');


/* =============================================================
 *  Helpers
 * ============================================================= */

/** Returns a fresh empty 9-cell board. */
function freshBoard()
{
  return Array(9).fill('');
}

/**
 * Fills the board in-place from a compact 9-character string.
 * 'X' → 'X', 'O' → 'O', anything else → '' (empty).
 *
 * @param {string[]} board
 * @param {string}   str   - e.g. "XOX OX OX"
 */
function setBoard(board, str)
{
  for (let i = 0; i < 9; i++)
  {
    const ch = str[i];
    board[i] = (ch === 'X' || ch === 'O') ? ch : '';
  }
}

/**
 * Scans all WIN_PATTERNS for a winning move, mirroring the medium AI.
 *
 * @param {string[]} board
 * @param {string}   mark
 * @returns {number|null}
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

/**
 * Recursive game player that tries every possible human move
 * against the minimax AI and verifies the AI never loses.
 *
 * @param {string[]} board
 * @param {string}   current - whose turn it is
 * @param {string}   ai
 * @param {string}   human
 * @returns {boolean}
 */
function aiNeverLoses(board, current, ai, human)
{
  const winner = getWinner(board);
  if (winner === human) return false;
  if (winner === ai)    return true;
  if (!board.includes('')) return true;

  const empty = getEmptyCells(board);

  if (current === ai)
  {
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
    for (const idx of empty)
    {
      board[idx] = human;
      const result = aiNeverLoses(board, ai, ai, human);
      board[idx] = '';

      if (!result) return false;
    }
    return true;
  }
}


/* =============================================================
 *  Tests — WIN_PATTERNS
 * ============================================================= */

describe('WIN_PATTERNS', () =>
{
  it('should contain exactly 8 winning patterns', () =>
  {
    assert.equal(WIN_PATTERNS.length, 8);
  });

  it('each pattern should be a 3-element array of indices 0-8', () =>
  {
    for (const pattern of WIN_PATTERNS)
    {
      assert.equal(pattern.length, 3);
      for (const idx of pattern)
      {
        assert.ok(idx >= 0 && idx <= 8, `index ${idx} out of range`);
      }
    }
  });

  it('should contain all 3 rows', () =>
  {
    assert.deepEqual(WIN_PATTERNS[0], [0, 1, 2]);
    assert.deepEqual(WIN_PATTERNS[1], [3, 4, 5]);
    assert.deepEqual(WIN_PATTERNS[2], [6, 7, 8]);
  });

  it('should contain all 3 columns', () =>
  {
    assert.deepEqual(WIN_PATTERNS[3], [0, 3, 6]);
    assert.deepEqual(WIN_PATTERNS[4], [1, 4, 7]);
    assert.deepEqual(WIN_PATTERNS[5], [2, 5, 8]);
  });

  it('should contain both diagonals', () =>
  {
    assert.deepEqual(WIN_PATTERNS[6], [0, 4, 8]);
    assert.deepEqual(WIN_PATTERNS[7], [2, 4, 6]);
  });
});


/* =============================================================
 *  Tests — getWinner
 * ============================================================= */

describe('getWinner', () =>
{
  it('should return null for an empty board', () =>
  {
    assert.equal(getWinner(Array(9).fill('')), null);
  });

  it('should detect X winning via top row', () =>
  {
    assert.equal(getWinner(['X','X','X', '','O','O', '','','']), 'X');
  });

  it('should detect O winning via middle row', () =>
  {
    assert.equal(getWinner(['X','','X', 'O','O','O', '','X','']), 'O');
  });

  it('should detect X winning via left column', () =>
  {
    assert.equal(getWinner(['X','O','', 'X','O','', 'X','','']), 'X');
  });

  it('should detect O winning via main diagonal', () =>
  {
    assert.equal(getWinner(['O','X','', 'X','O','', '','','O']), 'O');
  });

  it('should detect X winning via anti-diagonal', () =>
  {
    assert.equal(getWinner(['','','X', 'O','X','', 'X','O','']), 'X');
  });

  it('should return null when no winner yet', () =>
  {
    assert.equal(getWinner(['X','O','', '','X','', '','','O']), null);
  });

  it('should return null for a drawn (full) board', () =>
  {
    assert.equal(getWinner(['X','O','X', 'X','O','O', 'O','X','X']), null);
  });
});


/* =============================================================
 *  Tests — getEmptyCells
 * ============================================================= */

describe('getEmptyCells', () =>
{
  it('should return all 9 indices for an empty board', () =>
  {
    assert.deepEqual(getEmptyCells(Array(9).fill('')), [0,1,2,3,4,5,6,7,8]);
  });

  it('should return empty array for a full board', () =>
  {
    assert.deepEqual(getEmptyCells(['X','O','X', 'O','X','O', 'O','X','O']), []);
  });

  it('should return only empty positions', () =>
  {
    assert.deepEqual(getEmptyCells(['X','','X', '','O','', '','','O']), [1,3,5,6,7]);
  });

  it('should return single empty cell', () =>
  {
    assert.deepEqual(getEmptyCells(['X','O','X', 'O','X','O', 'O','X','']), [8]);
  });
});


/* =============================================================
 *  Tests — findWinningMove
 * ============================================================= */

describe('findWinningMove', () =>
{
  it('should find the winning cell when X has 2-in-a-row', () =>
  {
    assert.equal(findWinningMove(['X','X','', '','O','', '','','O'], [0,1,2], 'X'), 2);
  });

  it('should find the blocking cell when O has 2-in-a-row', () =>
  {
    assert.equal(findWinningMove(['O','','O', 'X','X','', '','',''], [0,1,2], 'O'), 1);
  });

  it('should return null when pattern has no 2-of-same-mark', () =>
  {
    assert.equal(findWinningMove(['X','O','', '','','', '','',''], [0,1,2], 'X'), null);
  });

  it('should return null for a full pattern', () =>
  {
    assert.equal(findWinningMove(['X','O','X', '','','', '','',''], [0,1,2], 'X'), null);
  });

  it('should find vertical winning move', () =>
  {
    assert.equal(findWinningMove(['O','X','', 'O','','', '','','X'], [0,3,6], 'O'), 6);
  });

  it('should find diagonal winning move', () =>
  {
    assert.equal(findWinningMove(['X','O','', '','X','', '','',''], [0,4,8], 'X'), 8);
  });
});


/* =============================================================
 *  Tests — checkResult
 * ============================================================= */

describe('checkResult', () =>
{
  it('should return null for an empty board', () =>
  {
    assert.equal(checkResult(freshBoard()), null);
  });

  it('should detect X win with pattern', () =>
  {
    const board = freshBoard();
    setBoard(board, 'XXX OO   ');
    const result = checkResult(board);
    assert.notEqual(result, null);
    assert.equal(result.type, 'win');
    assert.equal(result.winner, 'X');
    assert.deepEqual(result.pattern, [0, 1, 2]);
  });

  it('should detect O win via column', () =>
  {
    const board = freshBoard();
    setBoard(board, 'XO  OX O ');
    const result = checkResult(board);
    assert.notEqual(result, null);
    assert.equal(result.type, 'win');
    assert.equal(result.winner, 'O');
    assert.deepEqual(result.pattern, [1, 4, 7]);
  });

  it('should detect a draw when board is full with no winner', () =>
  {
    const board = freshBoard();
    setBoard(board, 'XOXXOOOXX');
    const result = checkResult(board);
    assert.notEqual(result, null);
    assert.equal(result.type, 'draw');
  });

  it('should return null for an in-progress game', () =>
  {
    const board = freshBoard();
    setBoard(board, 'XO  X    ');
    assert.equal(checkResult(board), null);
  });

  it('should detect diagonal win', () =>
  {
    const board = freshBoard();
    setBoard(board, 'X  OXO  X');
    const result = checkResult(board);
    assert.equal(result.type, 'win');
    assert.equal(result.winner, 'X');
    assert.deepEqual(result.pattern, [0, 4, 8]);
  });

  it('should detect anti-diagonal win', () =>
  {
    const board = freshBoard();
    setBoard(board, 'X O O O X');
    const result = checkResult(board);
    assert.equal(result.type, 'win');
    assert.equal(result.winner, 'O');
    assert.deepEqual(result.pattern, [2, 4, 6]);
  });
});


/* =============================================================
 *  Tests — minimax
 * ============================================================= */

describe('minimax', () =>
{
  it('should return positive score when AI (X) wins', () =>
  {
    const board = ['X','X','X', 'O','O','', '','',''];
    const score = minimax(board, 0, false, -Infinity, Infinity, 'X', 'O');
    assert.ok(score > 0, `expected positive, got ${score}`);
  });

  it('should return negative score when human (O) wins', () =>
  {
    const board = ['O','O','O', 'X','X','', '','',''];
    const score = minimax(board, 0, true, -Infinity, Infinity, 'X', 'O');
    assert.ok(score < 0, `expected negative, got ${score}`);
  });

  it('should return 0 for a drawn board', () =>
  {
    const board = ['X','O','X', 'X','O','O', 'O','X','X'];
    const score = minimax(board, 0, true, -Infinity, Infinity, 'X', 'O');
    assert.equal(score, 0);
  });

  it('should prefer immediate win (higher score at lower depth)', () =>
  {
    const board = ['X','X','', 'O','O','', '','',''];
    board[2] = 'X';
    const score = minimax(board, 1, false, -Infinity, Infinity, 'X', 'O');
    board[2] = '';
    assert.ok(score > 0, `expected positive, got ${score}`);
  });

  it('should correctly evaluate a nearly complete board', () =>
  {
    const board = ['X','O','X', 'O','X','O', 'O','X',''];
    const score = minimax(board, 0, true, -Infinity, Infinity, 'X', 'O');
    assert.ok(score > 0, `expected positive, got ${score}`);
  });
});


/* =============================================================
 *  Tests — Hard AI (minimax) is unbeatable
 * ============================================================= */

describe('Hard AI (unbeatable)', () =>
{
  it('AI (O) should never lose when human (X) goes first', () =>
  {
    assert.equal(aiNeverLoses(Array(9).fill(''), 'X', 'O', 'X'), true);
  });

  it('AI (X) should never lose when AI goes first', () =>
  {
    assert.equal(aiNeverLoses(Array(9).fill(''), 'X', 'X', 'O'), true);
  });
});


/* =============================================================
 *  Tests — findWinningMove integration (Medium AI helpers)
 * ============================================================= */

describe('findWinningMove across all patterns', () =>
{
  it('should find winning move for X on bottom row', () =>
  {
    assert.equal(findBestWinningMove(['O','','', 'O','X','', 'X','','X'], 'X'), 7);
  });

  it('should find blocking move against O on right column', () =>
  {
    assert.equal(findBestWinningMove(['','','O', 'X','X','O', '','',''], 'O'), 8);
  });

  it('should return null when no immediate win/block exists', () =>
  {
    const board = ['X','','', '','O','', '','',''];
    assert.equal(findBestWinningMove(board, 'X'), null);
    assert.equal(findBestWinningMove(board, 'O'), null);
  });

  it('should prioritise first found pattern', () =>
  {
    assert.equal(findBestWinningMove(['','X','X', 'X','O','', 'X','','O'], 'X'), 0);
  });
});


/* =============================================================
 *  Tests — Edge cases
 * ============================================================= */

describe('Edge cases', () =>
{
  it('getWinner should handle board with only one mark', () =>
  {
    assert.equal(getWinner(['X','','', '','','', '','','']), null);
  });

  it('getEmptyCells should handle board with single empty cell', () =>
  {
    assert.deepEqual(getEmptyCells(['X','O','X', 'O','X','O', 'O','X','']), [8]);
  });

  it('minimax should not mutate the board', () =>
  {
    const board    = ['X','O','', '', 'X','', '','','O'];
    const snapshot = [...board];
    minimax(board, 0, true, -Infinity, Infinity, 'X', 'O');
    assert.deepEqual(board, snapshot);
  });

  it('checkResult should detect all 8 win patterns', () =>
  {
    const winLayouts =
    [
      'XXX      ',
      '   XXX   ',
      '      XXX',
      'X  X  X  ',
      ' X  X  X ',
      '  X  X  X',
      'X   X   X',
      '  X X X  ',
    ];

    for (const layout of winLayouts)
    {
      const board = freshBoard();
      setBoard(board, layout);
      const result = checkResult(board);
      assert.notEqual(result, null, `no result for layout: ${layout}`);
      assert.equal(result.type, 'win');
      assert.equal(result.winner, 'X');
    }
  });
});


/* =============================================================
 *  Tests — Audio pipeline (playTone)
 *  -------------------------------------------------------------
 *  Each test creates a fresh AudioManager (so audioCtx is null)
 *  and installs a tracking mock before the first playTone call.
 *  No shared state or reset helpers needed.
 * ============================================================= */

describe('Audio pipeline', () =>
{
  const savedAudioContext = global.AudioContext;

  let audio;
  let muted;

  /**
   * Creates a tracking AudioContext mock.
   * Every meaningful API call is recorded in `calls`.
   * Must be called before audio.playTone() so the lazy context
   * picks up the mock on first creation.
   */
  function makeTrackingMock()
  {
    const calls = [];

    const mockCtx =
    {
      createOscillator()
      {
        return {
          type:      '',
          frequency: { value: 0 },
          connect()  { calls.push('osc.connect'); },
          start()    { calls.push('osc.start'); },
          stop(t)    { calls.push(['osc.stop', t]); },
        };
      },
      createGain()
      {
        return {
          gain:
          {
            _v: 0,
            get value()  { return this._v; },
            set value(v) { calls.push(['gain.value', v]); this._v = v; },
            setValueAtTime(v, t)              { calls.push(['gain.setValueAtTime', v, t]); },
            exponentialRampToValueAtTime(v, t) { calls.push(['gain.exponentialRamp', v, t]); },
          },
          connect() { calls.push('gain.connect'); },
        };
      },
      destination: {},
      currentTime: 100,
      state:       'running',
      resume()     { calls.push('ctx.resume'); return Promise.resolve(); },
    };

    global.AudioContext = function () { return mockCtx; };
    return { calls, mockCtx };
  }

  beforeEach(() =>
  {
    muted = false;
    audio = makeAudioManager(() => muted);
  });

  afterEach(() =>
  {
    global.AudioContext = savedAudioContext;
  });

  it('should set gain.value directly — NOT setValueAtTime', () =>
  {
    const { calls } = makeTrackingMock();
    audio.playTone(440, 0.12, 'sine', 0.15);

    const setValue = calls.find(c => Array.isArray(c) && c[0] === 'gain.value');
    assert.ok(setValue, 'gain.gain.value must be set directly');
    assert.equal(setValue[1], 0.15);

    const svat = calls.find(c => Array.isArray(c) && c[0] === 'gain.setValueAtTime');
    assert.equal(svat, undefined, 'setValueAtTime must NOT be used — it breaks the exponential ramp');
  });

  it('should schedule exponentialRampToValueAtTime to fade out', () =>
  {
    const { calls } = makeTrackingMock();
    audio.playTone(440, 0.12, 'sine', 0.15);

    const ramp = calls.find(c => Array.isArray(c) && c[0] === 'gain.exponentialRamp');
    assert.ok(ramp, 'exponentialRampToValueAtTime must be scheduled');
    assert.equal(ramp[1], 0.001, 'ramp target should be near-zero');
    assert.equal(ramp[2], 100.12, 'ramp end time should be currentTime + duration');
  });

  it('should connect osc → gain → destination and start/stop', () =>
  {
    const { calls } = makeTrackingMock();
    audio.playTone(440, 0.12);

    assert.ok(calls.includes('osc.connect'),  'oscillator must connect to gain');
    assert.ok(calls.includes('gain.connect'),  'gain must connect to destination');
    assert.ok(calls.includes('osc.start'),     'oscillator must start');

    const stop = calls.find(c => Array.isArray(c) && c[0] === 'osc.stop');
    assert.ok(stop, 'oscillator must stop');
    assert.equal(stop[1], 100.12, 'stop time should be currentTime + duration');
  });

  it('should call resume() when AudioContext is suspended', () =>
  {
    const { calls, mockCtx } = makeTrackingMock();
    mockCtx.state = 'suspended';

    audio.playTone(440, 0.12);
    assert.ok(calls.includes('ctx.resume'), 'must call resume() on suspended context');
  });

  it('should NOT call resume() when AudioContext is already running', () =>
  {
    const { calls, mockCtx } = makeTrackingMock();
    mockCtx.state = 'running';

    audio.playTone(440, 0.12);
    assert.ok(!calls.includes('ctx.resume'), 'must not call resume() on running context');
  });

  it('should do nothing when muted', () =>
  {
    const { calls } = makeTrackingMock();
    muted = true;

    audio.playTone(440, 0.12);
    assert.equal(calls.length, 0, 'no audio API calls when muted');
  });
});
