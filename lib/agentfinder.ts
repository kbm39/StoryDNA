import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.AGENTFINDER_SUPABASE_URL;
const key = process.env.AGENTFINDER_SUPABASE_KEY;

export interface Agent {
  id: string;
  name: string;
  agency: string | null;
  email: string | null;
  website: string | null;
  genres: string[];
  submission_requirements: string[];
  query_method: string | null;
  response_time: string | null;
  accepting: boolean | null;
  bio: string | null;
  notable_clients: string | null;
  media_focus: string | null;
}

/** Slim shape passed to the client agent picker. */
export interface AgentOption {
  id: string;
  name: string;
  agency: string | null;
  genres: string[];
  accepting: boolean | null;
}

export function isAgentFinderConfigured(): boolean {
  return Boolean(url && key);
}

function client() {
  if (!url || !key) {
    throw new Error(
      "PKagentfinder isn’t connected (set AGENTFINDER_SUPABASE_URL and AGENTFINDER_SUPABASE_KEY).",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** genres / submission_requirements may come back as arrays or JSON strings. */
function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string" && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {
      return v.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalize(row: Record<string, unknown>): Agent {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    agency: (row.agency as string) ?? null,
    email: (row.email as string) ?? null,
    website: (row.website as string) ?? null,
    genres: toArray(row.genres),
    submission_requirements: toArray(row.submission_requirements),
    query_method: (row.query_method as string) ?? null,
    response_time: (row.response_time as string) ?? null,
    accepting: (row.accepting as boolean) ?? null,
    bio: (row.bio as string) ?? null,
    notable_clients: (row.notable_clients as string) ?? null,
    media_focus: (row.media_focus as string) ?? null,
  };
}

export async function listAgentOptions(): Promise<AgentOption[]> {
  if (!isAgentFinderConfigured()) return [];
  const { data, error } = await client()
    .from("agents")
    .select("id, name, agency, genres, accepting")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const a = normalize(r as Record<string, unknown>);
    return { id: a.id, name: a.name, agency: a.agency, genres: a.genres, accepting: a.accepting };
  });
}

export async function getAgent(id: string): Promise<Agent | null> {
  if (!isAgentFinderConfigured()) return null;
  const { data, error } = await client().from("agents").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalize(data as Record<string, unknown>) : null;
}
