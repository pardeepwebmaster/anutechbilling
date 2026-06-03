import { describe, it, expect } from "vitest";
import { getCrumb } from "./nav";

describe("getCrumb", () => {
  it("returns the exact crumb for a known static route", () => {
    expect(getCrumb("/customers")).toEqual(["Workspace", "Customers"]);
    expect(getCrumb("/quotes/new")).toEqual(["Revenue", "Quotes", "New"]);
  });

  it("resolves dynamic detail routes via the [id] placeholder (not 'Dashboard')", () => {
    // The bug this fixes: exact lookup missed dynamic ids → everything fell back
    // to ["Workspace","Dashboard"]. A real customer id is a uuid.
    expect(getCrumb("/customers/17e61b78-9450-4849-ad93-9834d2281647")).toEqual(["Workspace", "Customers", "Profile"]);
    // Quote ids are prefixed text, not uuids.
    expect(getCrumb("/quotes/Q-ET-2026-27-0010")).toEqual(["Revenue", "Quotes", "Detail"]);
    expect(getCrumb("/invoices/INV-ET-2026-27-0006")).toEqual(["Revenue", "Invoices", "Detail"]);
  });

  it("resolves a nested dynamic route to its known [id] parent", () => {
    expect(getCrumb("/accounting/banking/some-account-id")).toEqual(["Accounting", "Banking", "Account"]);
  });

  it("falls back to the bare section path when no [id] entry exists", () => {
    // A hypothetical detail route under a section that only has the list entry.
    expect(getCrumb("/contacts/abc123")).toEqual(["Workspace", "Contacts"]);
  });

  it("falls back to Dashboard for a completely unknown route", () => {
    expect(getCrumb("/totally-unknown-xyz")).toEqual(["Workspace", "Dashboard"]);
  });
});
