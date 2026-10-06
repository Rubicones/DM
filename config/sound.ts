/**
 * Global rail-sound settings. Per-chapter engines live in lib/sound/engines
 * and are picked by each theme's `sound` field (config/themes.ts).
 */
export const soundConfig = {
  /** Master volume before the limiter (0…1). Kept low on purpose. */
  masterVolume: 0.3,
  /** Min interval between discrete triggers (dash / dot crossings), ms. Faster crossings are skipped, not queued. */
  minTriggerMs: 32,
  /** Gain multiplier for discrete triggers when crossings outpace the cap (fast scroll). */
  fastScrollGain: 0.65,
  /** Continuous engines start fading this long after the last movement frame, s. */
  releaseDelay: 0.06,
  /** …and decay with this time constant, s (≈ silent within ~150 ms). */
  releaseTau: 0.035,
  /**
   * Haptics (Vibration API, where supported — Android Chrome/Firefox; iOS Safari has none):
   * one short pulse per discrete tick of these engines, in ms. Only the dominant theme
   * vibrates (no double pulses inside a blend zone); off with prefers-reduced-motion.
   */
  haptics: { ratchet: 8, 'bass-dots': 14 } as Partial<Record<string, number>>,
  /** Min gap between pulses, ms (each vibrate() call cancels the previous one). */
  hapticMinMs: 45,
};
