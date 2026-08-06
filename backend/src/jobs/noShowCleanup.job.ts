import { floorService } from '../services/floor.service';

const JOB_INTERVAL_MS = 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let isCleanupRunning = false;

async function runCleanup() {
  if (isCleanupRunning) {
    console.log('[NoShowJob] Execution skipped: previous run still in progress');
    return;
  }
  isCleanupRunning = true;
  try {
    await floorService.cleanupNoShowBookings();
  } catch (err) {
    console.error('[NoShowJob] Error during cleanup:', err);
  } finally {
    isCleanupRunning = false;
  }
}

export function startNoShowCleanupJob() {
  if (intervalId) return;

  console.log('[NoShowJob] Started — checking every 1 minute for expired bookings');

  // Run once immediately
  void runCleanup();

  intervalId = setInterval(runCleanup, JOB_INTERVAL_MS);
}

export function stopNoShowCleanupJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[NoShowJob] Stopped');
  }
}