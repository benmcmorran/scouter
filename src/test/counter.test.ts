import { expect, test } from "vitest";
import { sum, setupCounter } from "../counter";

test("adds 1 + 2 to equal 3", () => {
  expect(sum(1, 2)).toBe(3);
});

test("counter increments when clicked", () => {
  const button = document.createElement("button");
  setupCounter(button);
  button.click();
  expect(button.innerHTML).toBe("count is 1");
});
