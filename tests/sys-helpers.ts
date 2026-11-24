import type { Snapshot } from '../src/core/sys/types.ts';
import { shanghai } from '../src/core/sys/util.ts';

export function snap(over: Partial<Snapshot> = {}): Snapshot {
  return {
    playSec: 100, delivered: 0, progress: 0, sourceTier: 0, routeTier: 0, era: 0, units: 2, shakes: 0, helperLevel: 0, combo: 0,
    coins: 0, income: 1, targetCost: 10, stockFill: 0, wasted: 0, idleSec: 0, sinceTierSec: 100, bottleneck: 'balanced',
    night: false, season: 0, weather: 'clear', wall: shanghai(Date.UTC(2026, 10, 24, 4)), eventOnScreen: null,
    ordersActive: 0, pestsActive: 0, offerOpen: false, goldSeen: false, hoardRatio: 0, eventsOnScreen: 0, sessionSec: 0, rotTotal: 0,
    milestone: null, sinceEventSec: 999, ordersDone: 0, pestsKilled: 0, offerCount: 0, ...over,
  };
}
