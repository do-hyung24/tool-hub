import { describe, expect, it } from "vitest";
import { formatAmountInput, formatPrice, parseAmountInput } from "./format";

describe("formatPrice", () => {
  it("adds thousands separators and the 원 suffix", () => {
    expect(formatPrice(30000)).toBe("30,000원");
  });

  it("formats zero the same way (callers decide whether to show 무료 instead)", () => {
    expect(formatPrice(0)).toBe("0원");
  });
});

describe("formatAmountInput", () => {
  it("adds thousands separators without a won suffix", () => {
    expect(formatAmountInput("30000")).toBe("30,000");
  });

  it("returns an empty string for empty input", () => {
    expect(formatAmountInput("")).toBe("");
  });
});

describe("parseAmountInput", () => {
  it("strips commas", () => {
    expect(parseAmountInput("30,000")).toBe("30000");
  });

  it("strips a trailing 원", () => {
    expect(parseAmountInput("30000원")).toBe("30000");
  });

  it("strips commas and a trailing 원 together", () => {
    expect(parseAmountInput("30,000원")).toBe("30000");
  });

  it("strips surrounding whitespace", () => {
    expect(parseAmountInput(" 30000 ")).toBe("30000");
  });
});
