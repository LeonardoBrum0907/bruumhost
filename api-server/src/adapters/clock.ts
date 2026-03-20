import type { ClockPort } from "../core/ports";

export const systemClock: ClockPort = {
   now: () => Date.now()
}