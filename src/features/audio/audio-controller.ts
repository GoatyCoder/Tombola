import { AUDIO_STORAGE_KEY } from '../../core/constants';
import { SpeechRequest } from '../../core/types';
import { qs } from '../../utils/dom';

const runtime = globalThis as typeof globalThis & {
  speechSynthesis?: SpeechSynthesis;
  localStorage?: Storage;
};

export class AudioController {
  #toggle: HTMLButtonElement | null = null;
  #enabled = true;
  #currentUtterance: SpeechSynthesisUtterance | null = null;
  #onChange: ((enabled: boolean) => void) | null = null;

  constructor(onChange?: (enabled: boolean) => void) {
    this.#toggle = document.querySelector<HTMLButtonElement>('#audio-toggle');
    this.#onChange = onChange ?? null;
    if (this.#toggle) {
      if (!runtime.speechSynthesis) {
        this.#enabled = false;
        this.#toggle.disabled = true;
        this.#toggle.title = 'Sintesi vocale non supportata su questo dispositivo';
        runtime.localStorage?.setItem(AUDIO_STORAGE_KEY, 'false');
      } else {
        this.#enabled = this.#toggle.getAttribute('aria-pressed') === 'true';
      }
      this.#toggle.addEventListener('click', () => this.toggle());
    }
  }

  setEnabled(value: boolean): void {
    this.#enabled = value;
    runtime.localStorage?.setItem(AUDIO_STORAGE_KEY, String(value));
    if (this.#toggle) {
      if (this.#toggle.disabled) {
        return;
      }
      this.#toggle.setAttribute('aria-pressed', value ? 'true' : 'false');
      this.#toggle.classList.toggle('button--muted', !value);
    }
    this.#onChange?.(value);
  }

  toggle(): void {
    this.setEnabled(!this.#enabled);
  }

  speak(request: SpeechRequest): void {
    if (!this.#enabled || !runtime.speechSynthesis) {
      return;
    }
    runtime.speechSynthesis.cancel();
    this.#currentUtterance = null;

    const utterances = request.messages.map((message) => {
      const utterance = new SpeechSynthesisUtterance(message.text);
      utterance.lang = message.locale;
      if (request.config?.voice) utterance.voice = request.config.voice;
      if (request.config?.rate) utterance.rate = request.config.rate;
      if (request.config?.pitch) utterance.pitch = request.config.pitch;
      return utterance;
    });

    utterances.forEach((utterance, index) => {
      utterance.onend = () => {
        if (index === utterances.length - 1) {
          this.#currentUtterance = null;
        }
      };
      this.#currentUtterance = utterance;
      runtime.speechSynthesis?.speak(utterance);
    });
  }

  cancel(): void {
    if (runtime.speechSynthesis) {
      runtime.speechSynthesis.cancel();
      this.#currentUtterance = null;
    }
  }
}
