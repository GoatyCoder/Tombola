import { TombolaEntry, SponsorEntry } from '../core/types';
import { ERROR_MESSAGES } from '../core/constants';
import { sanitizeUrl } from '../utils/sanitize';

interface NumbersResponse {
  numbers: TombolaEntry[];
}

export async function loadNumbers(dataUrl: string): Promise<TombolaEntry[]> {
  const response = await fetch(dataUrl, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`${ERROR_MESSAGES.data} (${response.status})`);
  }
  const payload = (await response.json()) as NumbersResponse;
  if (!payload || !Array.isArray(payload.numbers)) {
    throw new Error(ERROR_MESSAGES.data);
  }
  return payload.numbers
    .filter((entry) => typeof entry.number === 'number')
    .sort((a, b) => a.number - b.number);
}

export async function loadSponsors(url: string): Promise<SponsorEntry[]> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`${ERROR_MESSAGES.sponsors} (${response.status})`);
  }
  const payload = (await response.json()) as SponsorEntry[];
  if (!Array.isArray(payload)) {
    throw new Error(ERROR_MESSAGES.sponsors);
  }
  return payload
    .map((entry) => ({
      ...entry,
      url: sanitizeUrl(entry.url),
    }))
    .filter((entry) => Boolean(entry.logo && entry.url && entry.url !== '#'));
}
