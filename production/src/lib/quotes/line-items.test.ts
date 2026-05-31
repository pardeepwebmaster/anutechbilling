import { describe, it, expect } from "vitest";
import { addOrMergeLine } from "./line-items";
import type { QuoteLineItem } from "@/lib/supabase/database.types";

function line(over: Partial<QuoteLineItem> = {}): QuoteLineItem {
  return {
    id: `line-${Math.round(Number(over.qty ?? 1)) }-${over.item_id ?? "x"}-${over.rate ?? 0}`,
    name: "Google Workspace Starter",
    item_id: "GW-STR-fbb",
    qty: 10,
    rate: 3240,
    cost: 1320,
    commitment: "annual_yearly",
    ...over,
  } as QuoteLineItem;
}

describe("addOrMergeLine", () => {
  it("merges an economically-identical line (same item+term+rate, no discount) — bumps qty", () => {
    const start = [line({ id: "a" })];
    const r = addOrMergeLine(start, line({ id: "b" }));
    expect(r.merged).toBe(true);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].qty).toBe(20);
    expect(r.mergedQty).toBe(20);
  });

  it("does NOT mutate the input array", () => {
    const start = [line({ id: "a" })];
    addOrMergeLine(start, line({ id: "b" }));
    expect(start).toHaveLength(1);
    expect(start[0].qty).toBe(10);
  });

  it("keeps a separate line when commitment differs (annual vs monthly)", () => {
    const start = [line({ id: "a", commitment: "annual_yearly" })];
    const r = addOrMergeLine(start, line({ id: "b", commitment: "monthly" }));
    expect(r.merged).toBe(false);
    expect(r.lines).toHaveLength(2);
  });

  it("keeps a separate line when the rate differs (hand-edited price)", () => {
    const start = [line({ id: "a", rate: 3240 })];
    const r = addOrMergeLine(start, line({ id: "b", rate: 3000 }));
    expect(r.merged).toBe(false);
    expect(r.lines).toHaveLength(2);
  });

  it("keeps a separate line when an existing line carries a per-line discount", () => {
    const start = [line({ id: "a", discount_pct: 10 })];
    const r = addOrMergeLine(start, line({ id: "b" }));
    expect(r.merged).toBe(false);
    expect(r.lines).toHaveLength(2);
  });

  it("keeps separate lines for different products", () => {
    const start = [line({ id: "a", item_id: "GW-STR-fbb" })];
    const r = addOrMergeLine(start, line({ id: "b", item_id: "GW-STD-fbb", name: "Google Workspace Standard" }));
    expect(r.merged).toBe(false);
    expect(r.lines).toHaveLength(2);
  });

  it("never auto-merges custom items (no item_id)", () => {
    const start = [line({ id: "a", item_id: undefined, name: "Custom setup" })];
    const r = addOrMergeLine(start, line({ id: "b", item_id: undefined, name: "Custom setup" }));
    expect(r.merged).toBe(false);
    expect(r.lines).toHaveLength(2);
  });

  it("adds the first line to an empty quote", () => {
    const r = addOrMergeLine([], line({ id: "a" }));
    expect(r.merged).toBe(false);
    expect(r.lines).toHaveLength(1);
  });
});
