/**
 * AcceptQuoteButton — customer-side accept action for a project quotation.
 * Posts to the public accept API, then reloads to show the accepted state.
 */
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

export function AcceptQuoteButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const accept = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/project-quote/${projectId}/accept`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not accept");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div>
      <Button variant="primary" size="lg" icon="check" loading={loading} onClick={accept}>
        Accept quotation
      </Button>
      {error && <p className="text-sm text-rose mt-2">{error}</p>}
    </div>
  );
}
