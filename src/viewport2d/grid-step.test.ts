import { describe, expect, test } from "vitest";
import { readableGridStep } from "./grid-step.ts";

describe("readableGridStep", () => {
  test("uses 1 world unit when that is about 48 screen pixels", () => {
    expect(readableGridStep(48)).toBe(1);
  });

  test("steps down to 0.5 when zoomed in so a unit is 96px", () => {
    expect(readableGridStep(96)).toBe(0.5);
  });

  test("steps up to 2 when a unit is only 24px", () => {
    expect(readableGridStep(24)).toBe(2);
  });

  test("picks 5 from the 1-2-5 series when a unit is 12px", () => {
    expect(readableGridStep(12)).toBe(5);
  });

  test("picks 10 when zoomed out to 4.8px per unit", () => {
    expect(readableGridStep(4.8)).toBe(10);
  });

  test("picks 0.1 when zoomed in to 480px per unit", () => {
    expect(readableGridStep(480)).toBe(0.1);
  });
});
