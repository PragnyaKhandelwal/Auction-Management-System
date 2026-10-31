import { remindWatchers, settleDueAuctions } from "../services/bidding.service.js";

const TICK_MS = 5000;

let timer = null;
let isRunning = false;

export const tick = async () => {
  if (isRunning) return;
  isRunning = true;
  try {
    await settleDueAuctions();
    await remindWatchers();
  } catch (err) {
    console.error("Settlement tick failed:", err);
  } finally {
    isRunning = false;
  }
};

export const startSettlementWorker = () => {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
};

export const stopSettlementWorker = () => {
  clearInterval(timer);
  timer = null;
};
