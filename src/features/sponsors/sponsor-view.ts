import { SELECTORS } from '../../core/constants';
import { SponsorEntry } from '../../core/types';
import { qs, toggleHidden } from '../../utils/dom';

export class SponsorView {
  #showcase: HTMLElement;
  #list: HTMLElement;
  #drawBlock: HTMLElement;
  #drawLink: HTMLAnchorElement;
  #drawLogo: HTMLImageElement;
  #drawHeading: HTMLElement;

  constructor() {
    this.#showcase = qs<HTMLElement>(SELECTORS.sponsorShowcase);
    this.#list = qs<HTMLElement>(SELECTORS.sponsorShowcaseList);
    this.#drawBlock = qs<HTMLElement>(SELECTORS.drawSponsorBlock);
    this.#drawLink = qs<HTMLAnchorElement>(SELECTORS.drawSponsor);
    this.#drawLogo = qs<HTMLImageElement>(SELECTORS.drawSponsorLogo);
    this.#drawHeading = qs<HTMLElement>(SELECTORS.drawSponsorHeading);
  }

  renderShowcase(sponsors: SponsorEntry[]): void {
    if (sponsors.length === 0) {
      toggleHidden(this.#showcase, true);
      return;
    }

    toggleHidden(this.#showcase, false);
    this.#list.replaceChildren(
      ...sponsors.map((sponsor) => {
        const item = document.createElement('a');
        item.className = 'sponsor__item';
        item.href = sponsor.url;
        item.target = '_blank';
        item.rel = 'noopener noreferrer';
        item.setAttribute('role', 'listitem');
        item.innerHTML = `
          <img src="${sponsor.logo}" alt="${sponsor.name ?? 'Sponsor'}" loading="lazy" decoding="async" />
        `;
        return item;
      }),
    );
  }

  updateDrawSponsor(sponsor: SponsorEntry | null): void {
    if (!sponsor) {
      toggleHidden(this.#drawBlock, true);
      return;
    }

    toggleHidden(this.#drawBlock, false);
    this.#drawHeading.textContent = sponsor.name ?? 'Sponsor dell\'estrazione';
    this.#drawLink.href = sponsor.url;
    this.#drawLogo.src = sponsor.logo;
    this.#drawLogo.alt = sponsor.name ?? 'Logo sponsor';
    this.#drawLogo.loading = 'lazy';
    this.#drawLogo.decoding = 'async';
  }
}
