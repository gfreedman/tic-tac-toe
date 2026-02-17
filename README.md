# Tic-Tac-Toe

A polished, browser-based Tic-Tac-Toe game built with vanilla TypeScript — no frameworks, no runtime dependencies.

Features a dark neon theme, CSS-drawn animated marks, three AI difficulty levels, synthesised audio via the Web Audio API, session score tracking, and full keyboard/screen-reader accessibility.

**[Play it here](https://gfreedman.github.io/tic-tac-toe/)**

## Quick Start

```bash
npm install
npm run build                 # one-shot build → dist/script.js
npm run dev                   # watch mode with auto-rebuild
open index.html               # open in browser (Cmd+Shift+R to bypass cache)
node --test script.test.js    # run all 52 tests
```

## Features

- **Two game modes** — Player vs Player (local) and Player vs AI
- **Three AI difficulties**
  - **Easy** — random moves
  - **Medium** — blocks and takes winning moves, otherwise random
  - **Hard (Unbeatable)** — minimax algorithm with alpha-beta pruning
- **Dark neon theme** — deep navy background with cyan (X) and magenta (O) accents
- **CSS-drawn marks** — X and O rendered with pseudo-elements and animated on placement
- **Visual feedback** — ghost hover previews, placement pulse, winning cell glow, draw shake, win line overlay, and confetti on victory
- **Session scoreboard** — tracks wins and draws across rounds with animated score bumps
- **Sound effects** — synthesised tones via the Web Audio API with a mute toggle
- **Responsive design** — scales with `vmin` units; works on phones, tablets, and desktops
- **Accessible** — full keyboard navigation (Tab, Arrow keys, Enter/Space, Escape), ARIA grid roles, live region status announcements

## How to Play

1. Choose **Player vs Player** or **Player vs AI** from the menu
2. If playing against the AI, pick a difficulty and choose your side (X or O)
3. Click or tap a cell to place your mark (or use keyboard: Tab to focus, Enter to place)
4. First to get three in a row wins — or it's a draw
5. Press **Play Again** to keep the score going, or **Change Mode** to return to the menu

## Controls

| Key | Action |
|---|---|
| Tab | Move focus between cells |
| Arrow keys | Navigate the grid |
| Enter / Space | Place a mark |
| Escape | Go back / close overlay |

---

## Architecture

The codebase is split into six TypeScript modules with a strict one-directional dependency graph:

```
main.ts  ──→  Game  ──→  AIEngine     (pure logic, static methods)
                    ──→  AudioManager  (Web Audio API, no DOM)
                    ──→  UIManager     (all DOM manipulation)
```

### Module Overview

| File | Class | Responsibility |
|------|-------|----------------|
| `src/types.ts` | — | All shared types, interfaces, and global declarations |
| `src/ai.ts` | `AIEngine` | Win detection, board analysis, three AI strategies |
| `src/audio.ts` | `AudioManager` | Web Audio API tone synthesis, all sound effects |
| `src/ui.ts` | `UIManager` | All DOM reads/writes: screens, board, status, scoreboard, overlay, confetti |
| `src/game.ts` | `Game` | Game state, menu flow, turn management, AI scheduling, end-game sequence |
| `src/main.ts` | — | Bootstrap, event wiring, module exports for tests |

### Key Design Decisions

- **Shared mutable state** — A single `GameState` object is created in `main.ts` and passed by reference to `Game`, `UIManager`, and `AudioManager`. This avoids getter/setter boilerplate and lets the test suite mutate state directly.
- **No DOM in Game/AI** — `Game` never touches the DOM; it calls `UIManager` methods. `AIEngine` is fully pure (static methods, no state, no side effects).
- **AudioManager mute callback** — Instead of importing `GameState`, `AudioManager` receives a `() => state.muted` closure at construction time, keeping the dependency graph acyclic.
- **esbuild bundling** — Modules use ES imports internally. esbuild bundles them into a single `dist/script.js` with `--format=cjs` so the `module.exports` guard works in both Node (tests) and browsers (`<script>` tag, where `module` is undefined).

---

## Game Logic Flow

### Menu Navigation

```
[Menu Screen]
    │
    ├─ "Player vs Player"  →  [Game Screen]  →  startGame()
    │
    └─ "Player vs AI"      →  [Difficulty Screen]
                                    │
                                    └─ easy/medium/hard  →  [Side Screen]
                                                                │
                                                                └─ X or O  →  [Game Screen]  →  startGame()
```

Escape key navigates back one level at any point. All screen transitions use a 300ms CSS fade-out/swap/fade-in animation, with a lock flag to prevent double-click glitches.

### Turn Lifecycle (PvAI)

```
startGame()
    │
    ├─ Reset board to 9 empty cells, set X as current player
    ├─ Clear the DOM board, update status bar and hover classes
    ├─ If AI is X → scheduleAITurn()
    │
    └─ [Waiting for human input]
            │
            ▼
    handleCellAction(cellIndex)
        │
        ├─ Guard checks:
        │     • Game active?  Cell empty?  Input unlocked?
        │     • Not AI's turn?  AI not thinking?
        │
        ├─ placeMark(idx)
        │     └─ Update board array → render mark in DOM → play placement sound
        │
        ├─ checkResult()
        │     └─ Scan all 8 WIN_PATTERNS for three-in-a-row
        │        Check for full board (draw)
        │     │
        │     ├─ WinResult or DrawResult  →  endGame(result)
        │     │                                 └─ (see End Game Sequence below)
        │     │
        │     └─ null (game continues)
        │
        ├─ switchPlayer()  →  X↔O, refresh status + hover
        └─ scheduleAITurn()
                │
                ├─ Set aiThinking = true
                ├─ Show "AI is thinking..." with animated dots
                ├─ Wait 400–700ms (randomised humanising delay)
                │
                └─ [Timer fires]
                        │
                        ├─ AIEngine.chooseMove(board, difficulty, aiMark, playerMark)
                        │     └─ Returns the chosen cell index
                        ├─ placeMark(move)
                        ├─ aiThinking = false, inputLocked = false
                        │
                        ├─ checkResult()
                        │     ├─ Win/Draw  →  endGame(result)
                        │     └─ null      →  switchPlayer() back to human
                        │
                        └─ [Waiting for human input again]
```

### AI Strategies

| Difficulty | Strategy | Beatable? |
|-----------|----------|-----------|
| **Easy** | Random empty cell | Always |
| **Medium** | 1) Win if possible → 2) Block opponent's win → 3) Random | Usually |
| **Hard** | Minimax with alpha-beta pruning — evaluates the full game tree | Never (best outcome is a draw) |

The hard AI's minimax scores each board position relative to the AI: wins are positive (`10 - depth`, preferring faster wins), losses are negative (`depth - 10`, preferring slower losses), and draws are 0. Alpha-beta pruning eliminates branches that can't affect the outcome, making the search fast despite exploring the full tree.

### End Game Sequence

1. `gameActive = false`, `inputLocked = true` — prevent further moves
2. Status bar switches to "game-over" style (grey)

**On win:**
3. Highlight the three winning cells with a glow animation
4. Draw a gradient line connecting the first and last winning cell
5. Update status text ("You win!" / "AI wins!" / "{mark} wins!")
6. Increment the correct score counter, play win or loss jingle
7. After 1.2s delay → show overlay with message + confetti (human wins only)

**On draw:**
3. Shake all 9 cells
4. Update status text ("It's a draw!"), play draw beep
5. Increment draws counter
6. After 1.0s delay → show overlay with "It's a Draw!" (no confetti)

The overlay offers **Play Again** (new round, same settings) or **Change Mode** (back to menu).

---

## Testing

52 tests using Node's built-in test runner (`node:test`). No test framework dependencies.

```bash
node --test script.test.js
```

Test coverage:
- **WIN_PATTERNS** — structure, count, all rows/columns/diagonals
- **getWinner** — all win conditions, draws, in-progress boards
- **getEmptyCells** — empty, full, partial boards
- **findWinningMove** — rows, columns, diagonals, no-match cases
- **checkResult** — all 8 win patterns, draws, in-progress states
- **minimax** — score signs, draw = 0, depth preference, board immutability
- **Hard AI exhaustive proof** — recursively plays every possible human move against minimax and verifies the AI never loses (covers the entire game tree)
- **Audio pipeline** — verifies `gain.gain.value` (not `setValueAtTime`) is used before the exponential ramp, oscillator wiring, mute silencing, suspended context resume

---

## Project Structure

```
tic_tac_toe/
├── index.html          Single-page HTML shell
├── style.css           All styles (board, marks, animations, screens)
├── script.test.js      52 unit tests (Node built-in test runner)
├── package.json        Build scripts (esbuild)
├── tsconfig.json       TypeScript config (strict, ES2020, DOM)
├── src/
│   ├── types.ts        Shared types and interfaces
│   ├── ai.ts           AIEngine — win detection, minimax, move selection
│   ├── audio.ts        AudioManager — Web Audio API tone synthesis
│   ├── ui.ts           UIManager — all DOM manipulation
│   ├── game.ts         Game — state, orchestration, turn management
│   └── main.ts         Entry point — bootstrap, events, test exports
└── dist/
    └── script.js       Bundled output (loaded by index.html)
```

## License

MIT
