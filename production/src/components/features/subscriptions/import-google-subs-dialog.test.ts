import { describe, it, expect } from "vitest";
import { parseGoogle } from "./google-subs-parse";

/**
 * The Google→app subscription matcher writes money rows, so its classification
 * + MRR estimate are tested. We feed a tiny Google-style CSV and assert each row
 * lands in the right bucket (link / new / in_app) and that MRR = catalog × seats.
 */
const HEADER =
  "Customer,Product,Sku,Creation date (PST),Subscription status,Payment plan,Renewal date (PST),Assigned licenses,Purchased licenses,Customer uid,Cloud Identity Id,Provisioning id,Customer Number";

function csv(...rows: string[]) {
  return [HEADER, ...rows].join("\n");
}

const lookups = {
  // existing customer with number C-100 and domain link.com
  byNumber: new Map([["c-100", { id: "cust-1", name: "Linkable Pvt Ltd" }]]),
  byDomain: new Map([["link.com", { id: "cust-1", name: "Linkable Pvt Ltd" }]]),
  // an app subscription already exists on tracked.com
  appSubDomains: new Set(["tracked.com"]),
};
const priceMap = new Map([["google workspace business starter", 270]]);

describe("parseGoogle — Google reconciliation matcher", () => {
  it("links a row to an existing customer by Customer Number", () => {
    const text = csv(
      'newbiz.com,Google Workspace,Google Workspace Business Starter,"July 1, 2025",Active,ANNUAL,"July 1, 2026",5,5,uid1,cid1,prov1,C-100',
    );
    const { rows, custNumHeader } = parseGoogle(text, lookups, priceMap);
    expect(custNumHeader).toBe("Customer Number");
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe("link");
    expect(rows[0].customer_id).toBe("cust-1");
    expect(rows[0].estMrr).toBe(270 * 5);      // catalog × seats
    expect(rows[0].status).toBe("active");
  });

  it("flags an unmatched domain/number as needing a new customer", () => {
    const text = csv(
      'orphan.com,Google Workspace,Google Workspace Business Starter,"July 1, 2025",Active,ANNUAL,"July 1, 2026",2,2,uid2,cid2,prov2,C-999',
    );
    const { rows } = parseGoogle(text, lookups, priceMap);
    expect(rows[0].category).toBe("new");
    expect(rows[0].customer_id).toBeUndefined();
    expect(rows[0].estMrr).toBe(540);
  });

  it("skips a domain already tracked in the app", () => {
    const text = csv(
      'tracked.com,Google Workspace,Google Workspace Business Starter,"July 1, 2025",Active,ANNUAL,"July 1, 2026",10,10,uid3,cid3,prov3,C-555',
    );
    const { rows } = parseGoogle(text, lookups, priceMap);
    expect(rows[0].category).toBe("in_app");
  });

  it("ignores Cloud Identity Free + blank-SKU rows", () => {
    const text = csv(
      'free.com,Cloud Identity,Cloud Identity Free,"July 1, 2025",Active,FLEXIBLE,"July 1, 2026",3,3,uid4,cid4,prov4,C-1',
      'blank.com,Cloud Identity,-,"July 1, 2025",Active,,,0,0,uid5,cid5,prov5,C-2',
    );
    const { rows, skippedFree } = parseGoogle(text, lookups, priceMap);
    expect(rows).toHaveLength(0);
    expect(skippedFree).toBe(2);
  });

  it("maps Google 'Suspended' to paused", () => {
    const text = csv(
      'orphan2.com,Google Workspace,Google Workspace Business Starter,"July 1, 2025",Suspended,ANNUAL,"July 1, 2026",1,1,uid6,cid6,prov6,C-2',
    );
    const { rows } = parseGoogle(text, lookups, priceMap);
    expect(rows[0].status).toBe("paused");
  });

  it("falls back to domain match when no Customer Number column exists", () => {
    const noNumHeader =
      "Customer,Product,Sku,Creation date (PST),Subscription status,Payment plan,Renewal date (PST),Assigned licenses,Purchased licenses";
    const text = [
      noNumHeader,
      'link.com,Google Workspace,Google Workspace Business Starter,"July 1, 2025",Active,ANNUAL,"July 1, 2026",4,4',
    ].join("\n");
    const { rows, custNumHeader } = parseGoogle(text, lookups, priceMap);
    expect(custNumHeader).toBeNull();
    expect(rows[0].category).toBe("link");     // matched via byDomain
    expect(rows[0].customer_id).toBe("cust-1");
  });
});
