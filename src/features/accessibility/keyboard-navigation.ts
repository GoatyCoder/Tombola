import { BoardController } from '../board/board-controller';

const COLUMNS = 10;

export function registerBoardKeyboardNavigation(board: BoardController): () => void {
  function handler(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (!target || !target.classList.contains('board-cell')) return;
    const number = Number.parseInt(target.dataset.number ?? '', 10);
    if (!Number.isInteger(number)) return;

    let nextNumber: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
        nextNumber = number + 1;
        break;
      case 'ArrowLeft':
        nextNumber = number - 1;
        break;
      case 'ArrowDown':
        nextNumber = number + COLUMNS;
        break;
      case 'ArrowUp':
        nextNumber = number - COLUMNS;
        break;
      case 'Home':
        nextNumber = 1;
        break;
      case 'End':
        nextNumber = 90;
        break;
      default:
        return;
    }

    if (nextNumber !== null) {
      event.preventDefault();
      board.focusNumber(Math.min(Math.max(nextNumber, 1), 90));
    }
  }

  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
