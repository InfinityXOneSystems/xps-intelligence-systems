/**
 * XPS Intelligence — Real Search Engine
 *
 * Priority chain:
 *   1. Google Maps Places Text Search API
 *   2. SerpAPI Google Maps results
 *   3. Firecrawl Search
 *
 * NEVER returns seed data.
 */

import type { ScrapedLead } from "./scraper.js";

export interface SearchQuery {
  city: string;
  state: string;
  industry: string;
  keyword?: string;
  max_results?: number;
}

// ─── Google Maps Places ───────────────────────────────────────────────────────

interface GooglePlace {
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  place_id?: string;
}

interface GoogleTextSearchResult {
  results: Array<{
    name: string;
    formatted_address?: string;
    rating?: number;
    place_id?: string;
    types?: string[];
  }>;
  status: string;
}

async function fetchGooglePlaceDetails(placeId: string, apiKey: string): Promise<Partial<GooglePlace>> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,formatted_address,formatted_phone_number,website,rating");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return {};
  const data = await res.json() as { result?: Partial<GooglePlace> };
  return data.result || {};
}

async function searchGoogleMaps(query: SearchQuery): Promise<ScrapedLead[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not configured");

  const searchQuery = `${query.industry}${query.keyword ? " " + query.keyword : ""} in ${query.city}, ${query.state}`;
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", searchQuery);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("type", "establishment");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google Maps API error: ${res.status} ${res.statusText}`);

  const data = await res.json() as GoogleTextSearchResult;
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Maps API status: ${data.status}`);
  }

  const max = query.max_results ?? 30;
  const places = (data.results || []).slice(0, max);

  const leads: ScrapedLead[] = await Promise.all(
    places.map(async (place): Promise<ScrapedLead> => {
      let details: Partial<GooglePlace> = {};
      if (place.place_id && places.length <= 20) {
        try {
          details = await fetchGooglePlaceDetails(place.place_id, apiKey);
        } catch {
          // Skip details if request fails
        }
      }

      const score = Math.min(100, Math.max(40,
        50 +
        Math.round((place.rating ?? 0) * 6) +
        (details.website ? 10 : 0) +
        (details.formatted_phone_number ? 5 : 0)
      ));

      return {
        company_name: place.name,
        location: place.formatted_address || details.formatted_address || `${query.city}, ${query.state}`,
        phone: details.formatted_phone_number,
        website: details.website,
        vertical: query.industry,
        score,
        raw_data: {
          source: "google_maps",
          place_id: place.place_id,
          rating: place.rating,
          google_rating: place.rating,
        },
      };
    })
  );

  return leads;
}

// ─── SerpAPI ──────────────────────────────────────────────────────────────────

interface SerpApiLocalResult {
  title: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  type?: string;
}

async function searchSerpApi(query: SearchQuery): Promise<ScrapedLead[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY not configured");

  const searchQuery = `${query.industry}${query.keyword ? " " + query.keyword : ""} ${query.city} ${query.state}`;
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("type", "search");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status} ${res.statusText}`);

  const data = await res.json() as { local_results?: SerpApiLocalResult[]; error?: string };
  if (data.error) throw new Error(`SerpAPI: ${data.error}`);

  const max = query.max_results ?? 30;
  const results = (data.local_results || []).slice(0, max);

  return results.map((r): ScrapedLead => {
    const score = Math.min(100, Math.max(40,
      50 + Math.round((r.rating ?? 0) * 6) + (r.website ? 10 : 0) + (r.phone ? 5 : 0)
    ));
    return {
      company_name: r.title,
      location: r.address || `${query.city}, ${query.state}`,
      phone: r.phone,
      website: r.website,
      vertical: query.industry,
      score,
      raw_data: { source: "serpapi", rating: r.rating, type: r.type },
    };
  });
}

// ─── Firecrawl Search ─────────────────────────────────────────────────────────

interface FirecrawlSearchDoc {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
}

async function searchFirecrawl(query: SearchQuery): Promise<ScrapedLead[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

  const searchQuery = `${query.industry}${query.keyword ? " " + query.keyword : ""} ${query.city} ${query.state} businesses`;

  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: searchQuery,
      limit: Math.min(query.max_results ?? 30, 10),
      scrapeOptions: { formats: ["markdown"] },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Firecrawl search error: ${res.status} ${res.statusText}`);
  const data = await res.json() as { success: boolean; data?: FirecrawlSearchDoc[]; error?: string };
  if (!data.success) throw new Error(`Firecrawl search failed: ${data.error || "unknown"}`);

  return (data.data || []).map((doc): ScrapedLead => {
    let hostname = doc.url || "unknown";
    try { hostname = new URL(doc.url || "").hostname.replace(/^www\./, ""); } catch { /* noop */ }

    return {
      company_name: doc.title || hostname,
      website: doc.url,
      vertical: query.industry,
      location: `${query.city}, ${query.state}`,
      score: 55,
      raw_data: { source: "firecrawl_search", description: doc.description },
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchBusinesses(query: SearchQuery): Promise<{
  leads: ScrapedLead[];
  source: string;
  error?: string;
}> {
  // Attempt Google Maps first
  try {
    const leads = await searchGoogleMaps(query);
    console.log(`[SearchEngine] Google Maps returned ${leads.length} results`);
    return { leads, source: "google_maps" };
  } catch (err) {
    console.warn("[SearchEngine] Google Maps failed:", (err as Error).message);
  }

  // Fallback: SerpAPI
  try {
    const leads = await searchSerpApi(query);
    console.log(`[SearchEngine] SerpAPI returned ${leads.length} results`);
    return { leads, source: "serpapi" };
  } catch (err) {
    console.warn("[SearchEngine] SerpAPI failed:", (err as Error).message);
  }

  // Last resort: Firecrawl
  try {
    const leads = await searchFirecrawl(query);
    console.log(`[SearchEngine] Firecrawl returned ${leads.length} results`);
    return { leads, source: "firecrawl_search" };
  } catch (err) {
    console.warn("[SearchEngine] Firecrawl failed:", (err as Error).message);
    return {
      leads: [],
      source: "none",
      error: "All search providers failed — check GOOGLE_MAPS_API_KEY, SERPAPI_KEY, FIRECRAWL_API_KEY",
    };
  }
}
