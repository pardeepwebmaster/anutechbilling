/**
 * Company Document Vault — TanStack Query hooks.
 *
 * Files go to the private, tenant-foldered `documents` storage bucket
 * ({tenant_id}/{uuid}-{name}); metadata lives in the documents table.
 * Downloads use short-lived signed URLs. Delete removes both the row and the
 * stored file.
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { DocumentRow, DocumentCategory } from "@/lib/supabase/database.types";

export type { DocumentRow, DocumentCategory };

export const DOCUMENT_CATEGORIES: { key: DocumentCategory; label: string }[] = [
  { key: "company_legal", label: "Company & Legal" },
  { key: "gst_tax",       label: "GST & Tax" },
  { key: "banking",       label: "Banking" },
  { key: "agreements",    label: "Agreements & Contracts" },
  { key: "licenses",      label: "Licenses & Registrations" },
  { key: "hr",            label: "HR / Employees" },
  { key: "other",         label: "Other" },
];

export const categoryLabel = (k: string) =>
  DOCUMENT_CATEGORIES.find((c) => c.key === k)?.label ?? "Other";

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: async (): Promise<DocumentRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentRow[];
    },
    staleTime: 30_000,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      file:       File;
      title:      string;
      category:   DocumentCategory;
      expiryDate: string | null;
      notes:      string | null;
    }) => {
      // Server-side upload (admin client) — avoids browser→storage RLS quirks.
      const form = new FormData();
      form.append("file", input.file);
      form.append("title", input.title.trim());
      form.append("category", input.category);
      if (input.expiryDate) form.append("expiry_date", input.expiryDate);
      if (input.notes) form.append("notes", input.notes.trim());
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document uploaded");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
  });
}

/** Short-lived signed URL for viewing/downloading a document. */
export async function getDocumentSignedUrl(path: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: { id: string; file_path: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
      await supabase.storage.from("documents").remove([doc.file_path]); // best-effort
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete"),
  });
}

// ── Expiry helpers ────────────────────────────────────────────────────────────
export type ExpiryState = "expired" | "soon" | "ok" | "none";
export function expiryState(expiry: string | null, withinDays = 30): ExpiryState {
  if (!expiry) return "none";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(expiry + "T00:00:00");
  const days = Math.floor((d.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= withinDays) return "soon";
  return "ok";
}
