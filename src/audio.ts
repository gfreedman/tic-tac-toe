/**
 * ============================================================
 *  Tic-Tac-Toe — Audio Manager
 * ============================================================
 *  Owns the Web Audio API context and all sound effects.
 *  Synthesises tones on the fly — no external audio files.
 *
 *  IMPORTANT (regression note):
 *  `gain.gain.value = volume` MUST be used instead of
 *  `gain.gain.setValueAtTime(volume, ctx.currentTime)`.
 *  The `.value` setter sets the AudioParam's intrinsic value
 *  which `exponentialRampToValueAtTime` reads as its implicit
 *  start point.  `setValueAtTime` enters the automation
 *  timeline where the ramp can collapse to silence if the
 *  rendering quantum has already ticked past `currentTime`.
 *  There is a regression test enforcing this.
 * ============================================================
 */

import type { Player } from './types';


/** Named audio frequency constants (Hz). */
const NOTE =
{
  C4:       262,
  E4:       330,
  G4:       392,
  A4:       440,
  B4:       494,
  C5:       523,
  D5:       587,
  E5:       659,
  G5:       784,
  A5:       880,
  C6:       1047,
  X_PLACE:  600,
  Bb3:      233,
  Ab3:      208,
  Gb3:      185,
} as const;


/**
 * Manages all game audio through the Web Audio API.
 *
 * Receives a mute-check callback at construction time so it can
 * read the muted flag from the shared GameState without importing
 * it directly — keeping the dependency graph one-directional.
 */
export class AudioManager
{
  /** Lazily created AudioContext, shared across all tones. */
  private audioCtx: AudioContext | null = null;

  /** Callback that returns the current muted state. */
  private isMutedFn: () => boolean;

  /**
   * @param isMutedFn - Closure that returns `true` when audio should be silent.
   *                     Typically `() => state.muted` from main.ts.
   */
  constructor(isMutedFn: () => boolean)
  {
    this.isMutedFn = isMutedFn;
  }

  /**
   * Returns the shared AudioContext, creating it on first call.
   * Falls back to `webkitAudioContext` for older Safari versions.
   */
  private getAudioCtx(): AudioContext
  {
    if (!this.audioCtx)
    {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioCtx;
  }

  /**
   * Plays a single synthesised tone through the Web Audio API.
   *
   * Creates a short-lived oscillator → gain chain, starts it
   * immediately, and schedules an exponential fade-out to near-zero
   * over the given duration.  The oscillator auto-disconnects on stop.
   *
   * @param freq     - Frequency in Hz (e.g. 440 for concert A).
   * @param duration - Tone length in seconds.
   * @param type     - Oscillator waveform shape.
   * @param volume   - Initial gain (0–1).  Ramps down to 0.001.
   */
  playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.15): void
  {
    if (this.isMutedFn()) return;

    try
    {
      const ctx  = this.getAudioCtx();

      /* Resume the context if the browser suspended it (autoplay policy) */
      if (ctx.state === 'suspended') { ctx.resume(); }

      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type            = type;
      osc.frequency.value = freq;

      /* Set volume via .value (NOT setValueAtTime) — see file header */
      gain.gain.value     = volume;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      /* Wire: oscillator → gain → speakers */
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

  /**
   * Plays the mark-placement sound.
   * Higher-pitched triangle wave for X, lower for O.
   */
  playPlaceSound(mark: Player): void
  {
    this.playTone(mark === 'X' ? NOTE.X_PLACE : NOTE.A4, 0.12, 'triangle');
  }

  /**
   * Plays a celebratory "yay!" victory jingle.
   * Rising arpeggio C5→E5→G5→C6 with a bright triangle timbre,
   * finishing on a sustained high note for a triumphant feel.
   */
  playWinSound(): void
  {
    this.playTone(NOTE.C5, 0.15, 'triangle', 0.18);
    setTimeout(() => this.playTone(NOTE.E5, 0.15, 'triangle', 0.18), 100);
    setTimeout(() => this.playTone(NOTE.G5, 0.15, 'triangle', 0.18), 200);
    setTimeout(() => this.playTone(NOTE.C6, 0.4,  'sine',     0.2),  300);
  }

  /**
   * Plays a sad descending loss sound.
   * Slow chromatic descent Bb3→Ab3→Gb3 with a muted sawtooth,
   * evoking a "wah wah wahhh" trombone feel.
   */
  playLoseSound(): void
  {
    this.playTone(NOTE.Bb3, 0.25, 'sawtooth', 0.1);
    setTimeout(() => this.playTone(NOTE.Ab3, 0.25, 'sawtooth', 0.1),  250);
    setTimeout(() => this.playTone(NOTE.Gb3, 0.5,  'sawtooth', 0.1),  500);
  }

  /**
   * Plays a flat double-beep draw sound (square wave).
   * Intentionally monotone to convey "meh, nobody won."
   */
  playDrawSound(): void
  {
    this.playTone(NOTE.A4, 0.15, 'square', 0.08);
    setTimeout(() => this.playTone(NOTE.A4, 0.15, 'square', 0.08), 200);
  }

  /**
   * Resets the AudioContext reference to null.
   * Used by tests to inject a tracking mock between test cases.
   * @internal
   */
  _resetAudioCtx(): void
  {
    this.audioCtx = null;
  }
}
