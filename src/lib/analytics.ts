/**
 * Practice events for GoatCounter ("play-along/kalimba/ode-to-joy"). Does
 * nothing when analytics is off or blocked.
 */
type GoatCounter = { count?: (event: { path: string; title: string; event: boolean }) => void };

export function track(path: string): void {
  try {
    (window as Window & { goatcounter?: GoatCounter }).goatcounter?.count?.({ path, title: path, event: true });
  } catch {
    /* analytics must never break playing */
  }
}
