const board = document.getElementById("board");
const template = document.getElementById("board-cell-template");

const numbers = Array.from({ length: 90 }, (_, index) => index + 1);

numbers.forEach((number) => {
  const cell = template.content.firstElementChild.cloneNode(true);
  cell.dataset.number = number;
  cell.setAttribute("aria-label", `Numero ${number}`);

  const image = cell.querySelector("img");
  image.alt = `Numero ${number}`;

  board.appendChild(cell);
});
