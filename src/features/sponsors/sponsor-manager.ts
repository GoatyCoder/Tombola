import { SponsorEntry } from '../../core/types';

export class SponsorManager {
  #sponsors: SponsorEntry[] = [];
  #index = -1;

  setSponsors(sponsors: SponsorEntry[]): void {
    this.#sponsors = sponsors.slice();
    this.#index = -1;
  }

  getNext(): SponsorEntry | null {
    if (this.#sponsors.length === 0) return null;
    this.#index = (this.#index + 1) % this.#sponsors.length;
    return this.#sponsors[this.#index];
  }

  peek(): SponsorEntry | null {
    if (this.#index < 0) return null;
    return this.#sponsors[this.#index] ?? null;
  }
}
