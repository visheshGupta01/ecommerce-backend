function generateOrderNumber() {
  const date = new Date();

  const datePart =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");

  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `ORD-${datePart}-${randomPart}`;
}

export { generateOrderNumber };