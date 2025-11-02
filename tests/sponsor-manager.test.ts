import { describe, expect, it } from 'vitest';
import { SponsorManager } from '../src/features/sponsors/sponsor-manager';

const sponsors = [
  { logo: 'a.svg', url: 'https://a.example', name: 'A' },
  { logo: 'b.svg', url: 'https://b.example', name: 'B' },
  { logo: 'c.svg', url: 'https://c.example', name: 'C' },
];

describe('SponsorManager', () => {
  it('cycles through sponsors sequentially', () => {
    const manager = new SponsorManager();
    manager.setSponsors(sponsors);

    expect(manager.getNext()?.name).toBe('A');
    expect(manager.getNext()?.name).toBe('B');
    expect(manager.getNext()?.name).toBe('C');
    expect(manager.getNext()?.name).toBe('A');
  });

  it('returns null when no sponsors available', () => {
    const manager = new SponsorManager();
    expect(manager.getNext()).toBeNull();
  });
});
