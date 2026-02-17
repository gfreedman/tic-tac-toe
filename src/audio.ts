import type { Player } from './types';


/** Named audio frequency constants (Hz). */
const NOTE =
{
  C5:  523,
  E5:  659,
  G5:  784,
  A4:  440,
  X_PLACE: 600,
  LOSE_HI: 400,
  LOSE_LO: 300,
} as const;


export class AudioManager
{
  private audioCtx: AudioContext | null = null;
  private isMutedFn: () => boolean;

  constructor(isMutedFn: () => boolean)
  {
    this.isMutedFn = isMutedFn;
  }

  private getAudioCtx(): AudioContext
  {
    if (!this.audioCtx)
    {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioCtx;
  }

  playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.15): void
  {
    if (this.isMutedFn()) return;

    try
    {
      const ctx  = this.getAudioCtx();
      if (ctx.state === 'suspended') { ctx.resume(); }
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type            = type;
      osc.frequency.value = freq;
      gain.gain.value     = volume;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }
    catch (e)
    {
      console.error('playTone error:', e);
    }
  }

  playPlaceSound(mark: Player): void
  {
    this.playTone(mark === 'X' ? NOTE.X_PLACE : NOTE.A4, 0.12, 'triangle');
  }

  playWinSound(): void
  {
    this.playTone(NOTE.C5, 0.15, 'sine');
    setTimeout(() => this.playTone(NOTE.E5, 0.15, 'sine'), 100);
    setTimeout(() => this.playTone(NOTE.G5, 0.3,  'sine'), 200);
  }

  playLoseSound(): void
  {
    this.playTone(NOTE.LOSE_HI, 0.2,  'sawtooth', 0.1);
    setTimeout(() => this.playTone(NOTE.LOSE_LO, 0.3, 'sawtooth', 0.1), 150);
  }

  playDrawSound(): void
  {
    this.playTone(NOTE.A4, 0.15, 'square', 0.08);
    setTimeout(() => this.playTone(NOTE.A4, 0.15, 'square', 0.08), 200);
  }

  _resetAudioCtx(): void
  {
    this.audioCtx = null;
  }
}
