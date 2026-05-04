/**
 * Test-only entry point — never imported by the browser bundle.
 *
 * Exports pure functions and factory helpers used by script.test.js.
 * Having a dedicated test entry point keeps test infrastructure out
 * of main.ts, and lets tests import source TypeScript directly
 * instead of requiring the built bundle.
 */

import { AIEngine } from './ai';
import { AudioManager } from './audio';
import type { BoardCell, Player } from './types';

export const WIN_PATTERNS   = AIEngine.WIN_PATTERNS;
export const getWinner      = (board: BoardCell[]) => AIEngine.getWinner(board);
export const getEmptyCells  = (board: BoardCell[]) => AIEngine.getEmptyCells(board);
export const findWinningMove = (board: BoardCell[], pattern: readonly number[], mark: Player) =>
  AIEngine.findWinningMove(board, pattern, mark);
export const minimax = (
  board: BoardCell[], depth: number, isMaximizing: boolean,
  alpha: number, beta: number, ai: Player, human: Player,
) => AIEngine.minimax(board, depth, isMaximizing, alpha, beta, ai, human);
export const checkResult = (board: BoardCell[]) => AIEngine.checkResult(board);

/** Factory: returns a fresh AudioManager so each test gets an isolated context. */
export const makeAudioManager = (isMuted: () => boolean = () => false) =>
  new AudioManager(isMuted);
