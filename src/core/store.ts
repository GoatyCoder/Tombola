import { TombolaState, StoreSubscriber, CleanupTask } from './types';
import { DRAW_STATE_STORAGE_KEY, AUDIO_STORAGE_KEY, ERROR_MESSAGES } from './constants';
import { parseStoredState, persistState } from '../data/storage';
import { createEventBus } from '../utils/event-bus';

const INITIAL_STATE: TombolaState = Object.freeze({
  entries: [],
  status: 'idle',
  sponsorStatus: 'idle',
  drawnNumbers: [],
  selectedNumber: null,
  audioEnabled: true,
  isDrawing: false,
  historyOpen: false,
  sponsors: [],
  activeSponsor: null,
  history: [],
});

export class TombolaStore {
  #state: TombolaState = INITIAL_STATE;
  #subscribers = new Set<StoreSubscriber<TombolaState>>();
  #cleanup = new Set<CleanupTask>();
  #eventBus = createEventBus();

  get state(): Readonly<TombolaState> {
    return this.#state;
  }

  subscribe(callback: StoreSubscriber<TombolaState>): CleanupTask {
    this.#subscribers.add(callback);
    callback(this.#state);
    return () => this.#subscribers.delete(callback);
  }

  on(event: string, handler: EventListener): CleanupTask {
    return this.#eventBus.on(event, handler);
  }

  dispatch(event: string, detail: unknown): void {
    this.#eventBus.dispatch(event, detail);
  }

  registerCleanup(task: CleanupTask): void {
    this.#cleanup.add(task);
  }

  runCleanup(): void {
    for (const task of Array.from(this.#cleanup)) {
      try {
        task();
      } catch (error) {
        console.warn('Errore durante la pulizia delle risorse', error);
      } finally {
        this.#cleanup.delete(task);
      }
    }
  }

  initialiseFromStorage(): void {
    const { state: stored, invalid } = parseStoredState(DRAW_STATE_STORAGE_KEY);
    const audio = window.localStorage.getItem(AUDIO_STORAGE_KEY);

    if (stored) {
      this.#state = {
        ...this.#state,
        drawnNumbers: stored.drawnNumbers,
        history: stored.history,
        selectedNumber: stored.drawnNumbers.at(-1) ?? null,
      };
    }

    if (typeof audio === 'string') {
      this.#state = {
        ...this.#state,
        audioEnabled: audio === 'true',
      };
    }

    if (invalid) {
      this.setState({ lastError: ERROR_MESSAGES.storage });
    }
  }

  resetStorage(): void {
    window.localStorage.removeItem(DRAW_STATE_STORAGE_KEY);
    window.localStorage.removeItem(AUDIO_STORAGE_KEY);
  }

  setState(partial: Partial<TombolaState>, options: { persist?: boolean } = {}): void {
    const nextState: TombolaState = Object.freeze({
      ...this.#state,
      ...partial,
    });

    this.#state = nextState;

    if (options.persist) {
      persistState(DRAW_STATE_STORAGE_KEY, {
        drawnNumbers: nextState.drawnNumbers,
        history: nextState.history,
      });
    }

    for (const subscriber of this.#subscribers) {
      subscriber(nextState);
    }
  }

  setStatus(status: TombolaState['status']): void {
    this.setState({ status });
  }

  setSponsorStatus(status: TombolaState['sponsorStatus']): void {
    this.setState({ sponsorStatus: status });
  }

  reportStorageError(): void {
    this.setState({ lastError: ERROR_MESSAGES.storage });
  }
}

export const store = new TombolaStore();
