import { floorService } from '../services/floor.service';

const JOB_INTERVAL_MS = 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startNoShowCleanupJob() {
  if (intervalId) return;

  console.log('[NoShowJob] Started — checking every 1 minute for expired bookings');

  intervalId = setInterval(async () => {
    try {
      const count = await floorService.cleanupNoShowBookings();
      if (count > 0) {
        console.log(`[NoShowJob] ${new Date().toISOString()} — Cancelled ${count} no-show booking(s)`);
      }
    } catch (err) {
      console.error('[NoShowJob] Error during cleanup:', err);
    }
  }, JOB_INTERVAL_MS);
}

export function stopNoShowCleanupJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[NoShowJob] Stopped');
  }
}