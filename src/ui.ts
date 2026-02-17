import type { ScreenId, Player, GameMode, GameState, ScoreElements, WinResult, DrawResult } from './types';


const SCREEN_TRANSITION_MS = 300;

const CONFETTI_COUNT  = 80;
const SPARKLE_COUNT   = 30;
const CONFETTI_COLORS: readonly string[] = ['#0ff', '#f0f', '#ff0', '#0f0', '#f60', '#fff', '#f0f8', '#0ff8'];
const CONFETTI_SHAPES: readonly string[] = ['square', 'circle', 'sliver'];


export class UIManager
{
  private screens: Record<ScreenId, HTMLElement>;
  private overlay: HTMLElement;
  private overlayMessage: HTMLElement;
  private confettiContainer: HTMLElement;
  private statusEl: HTMLElement;
  private statusText: HTMLElement;
  private boardEl: HTMLElement;
  private cells: HTMLElement[];
  private scoreEls: ScoreElements;
  private muteToggle: HTMLElement;
  private muteIcon: HTMLElement;

  constructor()
  {
    this.screens =
    {
      menu:       document.getElementById('screen-menu')!,
      difficulty: document.getElementById('screen-difficulty')!,
      side:       document.getElementById('screen-side')!,
      game:       document.getElementById('screen-game')!,
    };

    this.overlay          = document.getElementById('overlay')!;
    this.overlayMessage   = document.getElementById('overlay-message')!;
    this.confettiContainer = document.getElementById('confetti-container')!;
    this.statusEl         = document.getElementById('status')!;
    this.statusText       = document.getElementById('status-text')!;
    this.boardEl          = document.getElementById('board')!;
    this.cells            = Array.from(document.querySelectorAll<HTMLElement>('.cell'));

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


  /* ---- Screen navigation ---- */

  showScreen(state: GameState, screenId: ScreenId, onReady?: () => void): void
  {
    if (state.isTransitioning) return;

    const current = this.screens[state.currentScreen];
    const next    = this.screens[screenId];

    if (current === next)
    {
      if (onReady) onReady();
      return;
    }

    state.isTransitioning = true;

    if (current)
    {
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
      next.classList.add('active');
      state.currentScreen   = screenId;
      state.isTransitioning = false;
      if (onReady) onReady();
    }
  }


  /* ---- Board ---- */

  clearBoard(): void
  {
    this.cells.forEach(cell =>
    {
      cell.className = 'cell';
      cell.replaceChildren();

      const idx = Number(cell.dataset.index);
      const row = Math.floor(idx / 3) + 1;
      const col = (idx % 3) + 1;
      cell.setAttribute('aria-label', `Row ${row}, Column ${col}, empty`);
    });

    const existingLine = this.boardEl.querySelector('.win-line');
    if (existingLine) existingLine.remove();
  }

  placeMark(idx: number, mark: Player): void
  {
    const cell = this.cells[idx];
    cell.classList.add('taken', 'pulse');

    const markEl = document.createElement('div');
    markEl.className = `mark ${mark.toLowerCase()}`;
    cell.appendChild(markEl);

    const row = Math.floor(idx / 3) + 1;
    const col = (idx % 3) + 1;
    cell.setAttribute('aria-label', `Row ${row}, Column ${col}, ${mark}`);
  }

  highlightWinningCells(pattern: number[]): void
  {
    pattern.forEach(idx => this.cells[idx].classList.add('winning'));
  }

  drawWinLine(pattern: number[]): void
  {
    const [a, , c] = pattern;
    const cellA     = this.cells[a];
    const cellC     = this.cells[c];
    const boardRect = this.boardEl.getBoundingClientRect();
    const rectA     = cellA.getBoundingClientRect();
    const rectC     = cellC.getBoundingClientRect();

    const ax = rectA.left + rectA.width  / 2 - boardRect.left;
    const ay = rectA.top  + rectA.height / 2 - boardRect.top;
    const cx = rectC.left + rectC.width  / 2 - boardRect.left;
    const cy = rectC.top  + rectC.height / 2 - boardRect.top;

    const length = Math.hypot(cx - ax, cy - ay);
    const angle  = Math.atan2(cy - ay, cx - ax) * (180 / Math.PI);

    const line = document.createElement('div');
    line.className             = 'win-line';
    line.style.width           = `${length + 20}px`;
    line.style.height          = '4px';
    line.style.left            = `${ax - 10}px`;
    line.style.top             = `${ay - 2}px`;
    line.style.transformOrigin = '0 50%';
    line.style.transform       = `rotate(${angle}deg)`;

    this.boardEl.appendChild(line);
  }

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

  updateHoverClasses(currentPlayer: Player, gameActive: boolean, aiThinking: boolean): void
  {
    const hoverClass = currentPlayer === 'X' ? 'x-hover' : 'o-hover';
    const focusClass = currentPlayer === 'X' ? 'x-turn'  : 'o-turn';

    this.cells.forEach(cell =>
    {
      cell.classList.remove('x-hover', 'o-hover', 'x-turn', 'o-turn');

      if (!cell.classList.contains('taken') && gameActive && !aiThinking)
      {
        cell.classList.add(hoverClass, focusClass);
      }
    });
  }

  getCells(): HTMLElement[]
  {
    return this.cells;
  }


  /* ---- Status bar ---- */

  updateStatus(gameActive: boolean, aiThinking: boolean, currentPlayer: Player, mode: GameMode | null, playerMark: Player): void
  {
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

  setStatusGameOver(): void
  {
    this.statusEl.className = 'game-over';
  }

  setStatusText(text: string): void
  {
    this.statusText.textContent = text;
  }


  /* ---- Scoreboard ---- */

  setScoreLabels(label1: string, label2: string): void
  {
    this.scoreEls.label1.textContent = label1;
    this.scoreEls.label2.textContent = label2;
  }

  updateScoreboard(scores: { p1: number; draws: number; p2: number }): void
  {
    this.animateScore(this.scoreEls.p1,    scores.p1);
    this.animateScore(this.scoreEls.draws, scores.draws);
    this.animateScore(this.scoreEls.p2,    scores.p2);
  }

  private animateScore(el: HTMLElement, value: number): void
  {
    const prev = Number(el.textContent);
    el.textContent = String(value);

    if (value > prev)
    {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }


  /* ---- Overlay ---- */

  showOverlay(result: WinResult | DrawResult, mode: GameMode | null, playerMark: Player): void
  {
    this.overlayMessage.className = 'overlay-message';
    this.confettiContainer.replaceChildren();

    if (result.type === 'win')
    {
      const winner = result.winner;

      if (mode === 'pvai')
      {
        this.overlayMessage.textContent = winner === playerMark ? 'You Win!' : 'AI Wins!';
      }
      else
      {
        this.overlayMessage.textContent = `${winner} Wins!`;
      }

      this.overlayMessage.classList.add(winner === 'X' ? 'x-win' : 'o-win');

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

    this.overlay.classList.add('active');
    this.overlay.setAttribute('aria-hidden', 'false');
    document.getElementById('btn-play-again')!.focus();
  }

  hideOverlay(): void
  {
    this.overlay.classList.remove('active');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.confettiContainer.replaceChildren();
  }

  isOverlayActive(): boolean
  {
    return this.overlay.classList.contains('active');
  }


  /* ---- Mute icon ---- */

  updateMuteIcon(muted: boolean): void
  {
    this.muteIcon.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
  }

  getMuteToggle(): HTMLElement
  {
    return this.muteToggle;
  }


  /* ---- Confetti ---- */

  private spawnConfetti(): void
  {
    for (let i = 0; i < CONFETTI_COUNT; i++)
    {
      const piece = document.createElement('div');
      const shape = CONFETTI_SHAPES[Math.floor(Math.random() * CONFETTI_SHAPES.length)];
      piece.className = `confetti-piece ${shape}`;

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


  /* ---- Ambient particles ---- */

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
