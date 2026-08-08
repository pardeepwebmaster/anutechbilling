import { describe, it, expect } from "vitest";
import { suggestCategory, findDuplicateExpense } from "./expenses";

describe("suggestCategory", () => {
  it("maps common notes to a category", () => {
    expect(suggestCategory("Team lunch with client")).toBe("Business Promotion");
    expect(suggestCategory("Uber to airport")).toBe("Travel");
    expect(suggestCategory("Airtel broadband bill")).toBe("Internet & Phone");
    expect(suggestCategory("Anthropic Claude subscription")).toBe("Software");
    expect(suggestCategory("AWS server hosting")).toBe("Hosting");
    expect(suggestCategory("Office rent July")).toBe("Office Rent");
    expect(suggestCategory("CA audit fees")).toBe("Professional Services");
    expect(suggestCategory("printer toner + paper")).toBe("Office Supplies");
    expect(suggestCategory("electricity bill")).toBe("Utilities");
  });
  it("understands Hinglish / Hindi notes", () => {
    expect(suggestCategory("client ke pass jane ke liye")).toBe("Travel");
    expect(suggestCategory("team ke liye khana")).toBe("Business Promotion");
    expect(suggestCategory("office ka kiraya")).toBe("Office Rent");
    expect(suggestCategory("bijli ka bill")).toBe("Utilities");
    expect(suggestCategory("mobile recharge")).toBe("Internet & Phone");
  });
  it("returns null when nothing matches (never a wrong guess)", () => {
    expect(suggestCategory("")).toBeNull();
    expect(suggestCategory("miscellaneous thing xyz")).toBeNull();
  });
  it("never guesses Salaries (that's Payroll)", () => {
    expect(suggestCategory("salary for staff")).not.toBe("Salaries");
  });
});

describe("findDuplicateExpense", () => {
  const list = [
    { id: "EXP-1", vendor_id: "v1", vendor_name: "Anthropic, PBC", bill_no: "G06-0014", expense_date: "2026-07-10", amount: 5304, category: "Software" },
    { id: "EXP-2", vendor_id: null, vendor_name: "Chai Point", bill_no: null, expense_date: "2026-08-01", amount: 250, category: "Business Promotion" },
    { id: "EXP-3", vendor_id: "v9", vendor_name: "Amazon", bill_no: "AMZ-77", expense_date: "2026-08-02", amount: 60000, category: "Equipment" },
  ];

  it("flags same vendor + same bill number", () => {
    const dup = findDuplicateExpense({ vendorId: "v1", vendorName: "Anthropic, PBC", billNo: "G06-0014" }, list);
    expect(dup?.id).toBe("EXP-1");
  });
  it("matches vendor by name when no id", () => {
    const dup = findDuplicateExpense({ vendorName: "anthropic, pbc", billNo: "G06-0014" }, list);
    expect(dup?.id).toBe("EXP-1");
  });
  it("falls back to vendor + date + amount when no bill number", () => {
    const dup = findDuplicateExpense({ vendorName: "Chai Point", billDate: "2026-08-01", amountInr: 250 }, list);
    expect(dup?.id).toBe("EXP-2");
  });
  it("does not flag a different bill number", () => {
    expect(findDuplicateExpense({ vendorName: "Anthropic, PBC", billNo: "G06-9999" }, list)).toBeNull();
  });
  it("excludes the row being edited (selfId)", () => {
    expect(findDuplicateExpense({ vendorId: "v1", billNo: "G06-0014" }, list, "EXP-1")).toBeNull();
  });
  it("same bill no. + SAME category = duplicate", () => {
    expect(findDuplicateExpense({ vendorId: "v9", billNo: "AMZ-77", category: "Equipment" }, list)?.id).toBe("EXP-3");
  });
  it("same bill no. + DIFFERENT category = split, not a duplicate", () => {
    expect(findDuplicateExpense({ vendorId: "v9", billNo: "AMZ-77", category: "Office Supplies" }, list)).toBeNull();
  });
});
