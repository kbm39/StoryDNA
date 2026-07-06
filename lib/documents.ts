import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ManuscriptDocument, DocType } from "@/lib/types";

export async function listDocuments(manuscriptId: string): Promise<ManuscriptDocument[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("manuscript_documents")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as ManuscriptDocument[];
  } catch {
    return [];
  }
}

export function groupDocuments(docs: ManuscriptDocument[]): Record<DocType, ManuscriptDocument[]> {
  const out = {
    synopsis: [],
    opening_critique: [],
    line_edit: [],
    continuity: [],
    marketing: [],
  } as Record<DocType, ManuscriptDocument[]>;
  for (const d of docs) (out[d.doc_type] ??= []).push(d);
  return out;
}

export async function getDocument(id: string): Promise<ManuscriptDocument | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("manuscript_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ManuscriptDocument) ?? null;
}
