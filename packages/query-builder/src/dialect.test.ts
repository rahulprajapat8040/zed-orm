import { describe, expect, it } from "vitest";
import { quoteIdentifier } from "./dialect.js";

describe("@zed-orm/query-builder dialect", () => {
  it("quotes PostgreSQL identifiers with double quotes", () => {
    expect(quoteIdentifier("postgresql", "User")).toBe('"User"');
    expect(quoteIdentifier("postgresql", 'say"hi')).toBe('"say""hi"');
  });

  it("quotes MySQL identifiers with backticks", () => {
    expect(quoteIdentifier("mysql", "User")).toBe("`User`");
    expect(quoteIdentifier("mysql", "say`hi")).toBe("`say``hi`");
  });
});
