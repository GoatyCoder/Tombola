import { SELECTORS } from '../../core/constants';
import { SponsorEntry, TombolaEntry } from '../../core/types';
import { qs, toggleHidden } from '../../utils/dom';
import { trapFocus } from '../../utils/a11y';
import { AudioController } from '../audio/audio-controller';
import { SPEECH_LOCALES } from '../../core/constants';

interface ModalContent {
  entry: TombolaEntry;
  sponsor: SponsorEntry | null;
}

export class ModalController {
  #modal: HTMLElement;
  #number: HTMLElement;
  #italian: HTMLElement;
  #dialect: HTMLElement;
  #image: HTMLImageElement;
  #imageFrame: HTMLElement;
  #close: HTMLButtonElement;
  #next: HTMLButtonElement;
  #nextLabel: HTMLElement;
  #sponsorBlock: HTMLElement;
  #sponsorLink: HTMLAnchorElement;
  #sponsorLogo: HTMLImageElement;
  #italianPlay: HTMLButtonElement;
  #dialectPlay: HTMLButtonElement;
  #audio: AudioController;
  #disposeFocusTrap: (() => void) | null = null;
  #pendingContent: ModalContent | null = null;

  constructor(audio: AudioController) {
    this.#audio = audio;
    this.#modal = qs<HTMLElement>(SELECTORS.modal);
    this.#number = qs<HTMLElement>(SELECTORS.modalNumber);
    this.#italian = qs<HTMLElement>(SELECTORS.modalItalian);
    this.#dialect = qs<HTMLElement>(SELECTORS.modalDialect);
    this.#image = qs<HTMLImageElement>(SELECTORS.modalImage);
    this.#imageFrame = qs<HTMLElement>(SELECTORS.modalImageFrame);
    this.#close = qs<HTMLButtonElement>(SELECTORS.modalClose);
    this.#next = qs<HTMLButtonElement>(SELECTORS.modalNext);
    this.#nextLabel = qs<HTMLElement>(SELECTORS.modalNextLabel);
    this.#sponsorBlock = qs<HTMLElement>(SELECTORS.modalSponsorBlock);
    this.#sponsorLink = qs<HTMLAnchorElement>(SELECTORS.modalSponsor);
    this.#sponsorLogo = qs<HTMLImageElement>(SELECTORS.modalSponsorLogo);
    this.#italianPlay = qs<HTMLButtonElement>(SELECTORS.modalItalianPlay);
    this.#dialectPlay = qs<HTMLButtonElement>(SELECTORS.modalDialectPlay);

    this.#close.addEventListener('click', () => this.hide());
    this.#modal.addEventListener('click', (event) => {
      if (event.target === this.#modal) {
        this.hide();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.#modal.hasAttribute('hidden')) {
        event.preventDefault();
        this.hide();
      }
    });
    this.#italianPlay.addEventListener('click', () => this.#playItalian());
    this.#dialectPlay.addEventListener('click', () => this.#playDialect());
  }

  show(content: ModalContent, options?: { nextLabel?: string; onNext?: () => void }): void {
    this.#pendingContent = content;
    this.#renderContent(content);

    if (options?.nextLabel) {
      this.#next.hidden = false;
      this.#next.disabled = false;
      this.#nextLabel.textContent = options.nextLabel;
      this.#next.onclick = options.onNext ?? null;
    } else {
      this.#next.hidden = true;
      this.#next.disabled = true;
      this.#next.onclick = null;
    }

    toggleHidden(this.#modal, false);
    this.#modal.scrollTop = 0;
    this.#disposeFocusTrap?.();
    this.#disposeFocusTrap = trapFocus(this.#modal.querySelector('.number-dialog') as HTMLElement);
  }

  hide(): void {
    toggleHidden(this.#modal, true);
    this.#disposeFocusTrap?.();
    this.#disposeFocusTrap = null;
    this.#audio.cancel();
  }

  #renderContent({ entry, sponsor }: ModalContent): void {
    this.#number.textContent = `${entry.number} — ${entry.italian}`;
    this.#italian.textContent = entry.italian;
    this.#dialect.textContent = entry.dialect ?? 'Nessuna traduzione disponibile';

    if (entry.image) {
      this.#image.src = entry.image;
      this.#image.alt = entry.italian;
      this.#image.loading = 'lazy';
      this.#image.decoding = 'async';
      this.#imageFrame.classList.remove('number-dialog__image-frame--empty');
    } else {
      this.#image.removeAttribute('src');
      this.#image.alt = '';
      this.#imageFrame.classList.add('number-dialog__image-frame--empty');
    }

    if (sponsor) {
      toggleHidden(this.#sponsorBlock, false);
      this.#sponsorLink.href = sponsor.url;
      this.#sponsorLogo.src = sponsor.logo;
      this.#sponsorLogo.alt = sponsor.name ?? 'Logo sponsor';
    } else {
      toggleHidden(this.#sponsorBlock, true);
    }
  }

  #playItalian(): void {
    if (!this.#pendingContent) return;
    this.#audio.speak({
      messages: [{ text: this.#pendingContent.entry.italian, locale: SPEECH_LOCALES.italian }],
    });
  }

  #playDialect(): void {
    if (!this.#pendingContent) return;
    const phrase = this.#pendingContent.entry.dialect ?? this.#pendingContent.entry.italian;
    this.#audio.speak({
      messages: [{ text: phrase, locale: SPEECH_LOCALES.dialect }],
    });
  }
}
