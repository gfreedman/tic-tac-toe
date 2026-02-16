# Tic-Tac-Toe

A polished, browser-based Tic-Tac-Toe game built with vanilla HTML, CSS, and JavaScript. Features a dark neon theme, CSS-drawn animated marks, three AI difficulty levels, and full keyboard/screen-reader accessibility.

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

## Getting Started

No build step required. Just open the file in a browser:

```bash
open index.html
```

Or serve it locally:

```bash
npx serve .
```

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

## Tech Stack

- **HTML5** — semantic markup with ARIA roles
- **CSS3** — custom properties, grid/flexbox layout, keyframe animations, `clamp()`/`vmin` responsive sizing
- **Vanilla JavaScript** — no frameworks or dependencies

## Project Structure

```
├── index.html    — Page structure, screens, board, overlay
├── style.css     — Dark theme, animations, responsive layout
├── script.js     — Game logic, AI, audio, state management
└── README.md
```

## License

MIT
