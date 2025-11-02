import { DrawHistoryEntry } from '../core/types';

export interface StoredState {
  drawnNumbers: number[];
  history: DrawHistoryEntry[];
}

function isValidStoredState(value: unknown): value is StoredState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredState>;
  if (!Array.isArray(candidate.drawnNumbers) || !Array.isArray(candidate.history)) {
    return false;
  }
  const numbersValid = candidate.drawnNumbers.every(
    (n) => Number.isInteger(n) && n >= 1 && n <= 90,
  );
  const historyValid = candidate.history.every((entry) =>
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as DrawHistoryEntry).number === 'number' &&
    Number.isInteger((entry as DrawHistoryEntry).number),
  );
  return numbersValid && historyValid;
}

export interface ParsedStateResult {
  state: StoredState | null;
  invalid: boolean;
}

export function parseStoredState(key: string): ParsedStateResult {
  let invalid = false;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { state: null, invalid };
    const parsed = JSON.parse(raw);
    if (isValidStoredState(parsed)) {
      return { state: parsed, invalid };
    }
    console.warn('Stato salvato non valido, verrà ignorato');
    invalid = true;
    return { state: null, invalid };
  } catch (error) {
    console.warn('Impossibile leggere i dati salvati', error);
    invalid = true;
    return { state: null, invalid };
  }
}

export function persistState(key: string, state: StoredState): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.warn('Impossibile salvare lo stato', error);
  }
}
