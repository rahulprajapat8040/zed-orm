import type { SqlDialect } from "./meta.js";

/** Collects bind parameters and renders dialect-specific placeholders. */
export class ParamCollector {
  private readonly values: unknown[] = [];

  constructor(private readonly dialect: SqlDialect) {}

  add(value: unknown): string {
    this.values.push(value);
    if (this.dialect === "postgresql") {
      return `$${this.values.length}`;
    }
    return "?";
  }

  get params(): readonly unknown[] {
    return this.values;
  }
}
