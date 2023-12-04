import { expect, test, describe } from "vitest";
import { sum, setupCounter } from "../counter";
import {
  getOverpassResults,
  getOverpassQLForTerm,
  presetSearchTerms,
} from "../openstreetmap";

test("adds 1 + 2 to equal 3", () => {
  expect(sum(1, 2)).toBe(3);
});

test("counter increments when clicked", () => {
  const button = document.createElement("button");
  setupCounter(button);
  button.click();
  expect(button.innerHTML).toBe("count is 1");
});

test("can find light rail stations in Seattle", async () => {
  const query = getOverpassQLForTerm(
    "light rail station",
    "47.489939,-122.445140,47.735581,-121.992185",
  );
  expect(query).toBeDefined();

  const result = await getOverpassResults(query!);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const names = (result as any).elements.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (element: any) => element.tags.name,
  );

  const expected = [
    "Northgate",
    "Beacon Hill",
    "University of Washington",
    "Capitol Hill",
    "International District/Chinatown",
    "Westlake",
    "University Street",
    "Pioneer Square",
    "Roosevelt",
    "U District",
    "Stadium",
    "SODO",
    "Othello",
    "Columbia City",
    "Mount Baker",
    "Rainier Beach",
    "Downtown Redmond",
    "Marymoor Village Station",
  ];

  expect(names).toEqual(expect.arrayContaining(expected));
  expect(names.length).toEqual(expected.length);
});

describe("OverpassQL query generation", () => {
  for (const term of presetSearchTerms) {
    test(`can create a query for \"${term}\"`, () => {
      expect(getOverpassQLForTerm(term, "dummy bbox")).toBeTypeOf("string");
    });
  }
});
