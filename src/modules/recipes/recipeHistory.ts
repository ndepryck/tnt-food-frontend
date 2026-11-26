const key = "recipes:history:v1";
type Ledger = { epoch: string; catalogue: number; details: Record<string, number> };
type Entry = { getState(): Record<string, unknown> | undefined };
type Navigation = {
  currentEntry: Entry;
  activation?: { from: Entry | null };
  updateCurrentEntry(options: { state: Record<string, unknown> }): void;
};
function navigation() {
  const nav = (window as Window & { navigation?: Navigation }).navigation;
  return nav?.currentEntry && "activation" in nav && typeof nav.updateCurrentEntry === "function" ? nav : undefined;
}

// Carry revisions on the actual departing history entry. Publish them while
// the document is active, not during pagehide (too late across renderers).
// Older browsers use an atomic session-storage record instead.
function arrive(): Ledger {
  try {
    const nav = navigation();
    const saved = nav ? nav.activation?.from?.getState()?.[key] : JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (typeof saved?.epoch === "string" && Number.isSafeInteger(saved.catalogue) && saved.details) return saved;
  } catch { /* An unverifiable visit starts a new lineage. */ }
  return { epoch: crypto.getRandomValues(new Uint32Array(4)).join("-"), catalogue: 0, details: {} };
}
function publish(ledger: Ledger) {
  try {
    const nav = navigation();
    if (nav) nav.updateCurrentEntry({ state: { ...nav.currentEntry.getState(), [key]: ledger } });
    else sessionStorage.setItem(key, JSON.stringify(ledger));
  } catch {
    try { sessionStorage.removeItem(key); } catch { /* Storage disabled. */ }
  }
}

export function recipeHistory() {
  let ledger = arrive();
  let leavingWrite = false;
  publish(ledger);
  return {
    written(id: string) {
      ledger.details[id.toLowerCase()] = ++ledger.catalogue;
      publish(ledger);
    },
    leavingAfterWrite() { leavingWrite = true; },
    restore(detailId?: string) {
      const next = arrive();
      const id = detailId?.toLowerCase();
      const comparable = ledger.epoch === next.epoch;
      const changed = leavingWrite || (comparable &&
        (id ? ledger.details[id] !== next.details[id] : ledger.catalogue !== next.catalogue));
      ledger = next;
      publish(ledger);
      leavingWrite = false;
      // An unchanged storage record cannot vouch for a different document
      // whose writes to that storage were denied.
      return changed ? "changed" : comparable && navigation() ? "current" : "unknown";
    },
  };
}
export const recipeVisits = recipeHistory();
