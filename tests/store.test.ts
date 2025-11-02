import { describe, expect, it, beforeEach } from 'vitest';
import { TombolaStore } from '../src/core/store';
import { ERROR_MESSAGES } from '../src/core/constants';

function createStore() {
  return new TombolaStore();
}

describe('TombolaStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('notifies subscribers when state changes', () => {
    const store = createStore();
    const states: number[] = [];
    store.subscribe((state) => states.push(state.drawnNumbers.length));

    store.setState({ drawnNumbers: [1, 2, 3] });

    expect(states.at(-1)).toBe(3);
  });

  it('persists drawn numbers when requested', () => {
    const store = createStore();
    store.setState({ drawnNumbers: [42], history: [] }, { persist: true });

    const persisted = window.localStorage.getItem('tombola:draw-state');
    expect(persisted).toContain('42');
  });

  it('restores valid state from storage', () => {
    window.localStorage.setItem(
      'tombola:draw-state',
      JSON.stringify({ drawnNumbers: [7], history: [] }),
    );
    const store = createStore();
    store.initialiseFromStorage();

    expect(store.state.drawnNumbers).toEqual([7]);
    expect(store.state.selectedNumber).toBe(7);
  });

  it('flags invalid storage content', () => {
    window.localStorage.setItem('tombola:draw-state', 'not-json');
    const store = createStore();
    store.initialiseFromStorage();

    expect(store.state.lastError).toBe(ERROR_MESSAGES.storage);
  });
});
