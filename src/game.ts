import type { GameState, Difficulty, Player, ScreenId, GameResult, WinResult, DrawResult } from './types';
import { AIEngine } from './ai';
import { AudioManager } from './audio';
import { UIManager } from './ui';


const AI_DELAY_MIN_MS      = 400;
const AI_DELAY_JITTER_MS   = 300;
const WIN_OVERLAY_DELAY_MS = 1200;
const DRAW_OVERLAY_DELAY_MS = 1000;


export class Game
{
  constructor(
    private state: GameState,
    private ui: UIManager,
    private audio: AudioManager,
  ) {}

  getState(): GameState
  {
    return this.state;
  }


  /* ---- Menu flow ---- */

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

  startPvAI(): void
  {
    this.state.mode = 'pvai';
    this.ui.showScreen(this.state, 'difficulty');
  }

  setDifficulty(difficulty: Difficulty): void
  {
    this.state.difficulty = difficulty;
    this.ui.showScreen(this.state, 'side');
  }

  setSide(side: Player): void
  {
    this.state.playerMark = side;
    this.state.aiMark     = side === 'X' ? 'O' : 'X';
    this.state.scores     = { p1: 0, draws: 0, p2: 0 };

    this.ui.setScoreLabels(`You (${this.state.playerMark})`, `AI (${this.state.aiMark})`);
    this.ui.updateScoreboard(this.state.scores);
    this.ui.showScreen(this.state, 'game', () => this.startGame());
  }

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


  /* ---- Core game ---- */

  startGame(): void
  {
    this.clearPendingTimers();

    this.state.board         = Array(9).fill('');
    this.state.currentPlayer = 'X';
    this.state.gameActive    = true;
    this.state.inputLocked   = false;

    this.ui.clearBoard();
    this.ui.updateStatus(this.state.gameActive, this.state.aiThinking, this.state.currentPlayer, this.state.mode, this.state.playerMark);
    this.ui.updateHoverClasses(this.state.currentPlayer, this.state.gameActive, this.state.aiThinking);

    if (this.state.mode === 'pvai' && this.state.aiMark === 'X')
    {
      this.scheduleAITurn();
    }
  }

  handleCellAction(cellIndex: number): void
  {
    if (!this.state.gameActive || this.state.board[cellIndex] !== '' || this.state.aiThinking || this.state.inputLocked)
    {
      return;
    }

    if (this.state.mode === 'pvai' && this.state.currentPlayer !== this.state.playerMark)
    {
      return;
    }

    this.state.inputLocked = true;
    this.placeMark(cellIndex);

    const result = this.checkResult();
    if (result)
    {
      this.endGame(result);
      return;
    }

    this.switchPlayer();
    this.state.inputLocked = false;

    if (this.state.mode === 'pvai' && this.state.gameActive)
    {
      this.scheduleAITurn();
    }
  }

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

  handlePlayAgain(): void
  {
    this.ui.hideOverlay();
    this.startGame();
  }

  handleChangeMode(): void
  {
    this.ui.hideOverlay();
    this.clearPendingTimers();
    this.ui.showScreen(this.state, 'menu');
  }

  toggleMute(): void
  {
    this.state.muted = !this.state.muted;
    this.ui.updateMuteIcon(this.state.muted);
  }


  /* ---- Internals ---- */

  private scheduleAITurn(): void
  {
    this.state.aiThinking = true;
    this.ui.updateStatus(this.state.gameActive, this.state.aiThinking, this.state.currentPlayer, this.state.mode, this.state.playerMark);
    this.ui.updateHoverClasses(this.state.currentPlayer, this.state.gameActive, this.state.aiThinking);

    const delay = AI_DELAY_MIN_MS + Math.random() * AI_DELAY_JITTER_MS;
    this.state.aiTimeoutId = setTimeout(() =>
    {
      this.state.aiTimeoutId = null;

      if (!this.state.gameActive) return;

      const move = AIEngine.chooseMove(this.state.board, this.state.difficulty!, this.state.aiMark!, this.state.playerMark);
      if (move !== null && move !== undefined)
      {
        this.placeMark(move);
      }

      this.state.aiThinking  = false;
      this.state.inputLocked = false;

      const result = this.checkResult();
      if (result)
      {
        this.endGame(result);
      }
      else
      {
        this.switchPlayer();
        this.ui.updateStatus(this.state.gameActive, this.state.aiThinking, this.state.currentPlayer, this.state.mode, this.state.playerMark);
        this.ui.updateHoverClasses(this.state.currentPlayer, this.state.gameActive, this.state.aiThinking);
      }
    }, delay);
  }

  private placeMark(idx: number): void
  {
    const mark = this.state.currentPlayer;
    this.state.board[idx] = mark;

    this.ui.placeMark(idx, mark);
    this.audio.playPlaceSound(mark);
  }

  private switchPlayer(): void
  {
    this.state.currentPlayer = this.state.currentPlayer === 'X' ? 'O' : 'X';
    this.ui.updateStatus(this.state.gameActive, this.state.aiThinking, this.state.currentPlayer, this.state.mode, this.state.playerMark);
    this.ui.updateHoverClasses(this.state.currentPlayer, this.state.gameActive, this.state.aiThinking);
  }

  checkResult(): GameResult
  {
    for (const pattern of AIEngine.WIN_PATTERNS)
    {
      const [a, b, c] = pattern;

      if (this.state.board[a] && this.state.board[a] === this.state.board[b] && this.state.board[a] === this.state.board[c])
      {
        return { type: 'win', winner: this.state.board[a] as Player, pattern };
      }
    }

    if (!this.state.board.includes(''))
    {
      return { type: 'draw' };
    }

    return null;
  }

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

  private endGameWithWin(result: WinResult): void
  {
    this.ui.highlightWinningCells(result.pattern);
    this.ui.drawWinLine(result.pattern);
    this.updateWinStatus(result.winner);
    this.ui.updateScoreboard(this.state.scores);

    this.state.overlayTimeoutId = setTimeout(() =>
    {
      this.state.overlayTimeoutId = null;
      this.ui.showOverlay(result, this.state.mode, this.state.playerMark);
    }, WIN_OVERLAY_DELAY_MS);
  }

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

  private endGameWithDraw(_result: DrawResult): void
  {
    this.ui.setStatusText('It\'s a draw!');
    this.state.scores.draws++;
    this.ui.updateScoreboard(this.state.scores);
    this.audio.playDrawSound();
    this.ui.shakeCells();

    this.state.overlayTimeoutId = setTimeout(() =>
    {
      this.state.overlayTimeoutId = null;
      this.ui.showOverlay({ type: 'draw' }, this.state.mode, this.state.playerMark);
    }, DRAW_OVERLAY_DELAY_MS);
  }

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
