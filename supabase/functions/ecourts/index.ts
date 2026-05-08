// eCourts India API proxy
// Supports: search, case detail, cause-list, available-dates
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://webapi.ecourtsindia.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("ECOURTS_API_TOKEN");
    if (!token) {
      return json({ error: "ECOURTS_API_TOKEN not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    let url = "";
    let init: RequestInit = {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    };

    if (action === "search") {
      const params = new URLSearchParams();
      const allowed = [
        "query", "advocates", "judges", "petitioners", "respondents", "litigants",
        "courtCodes", "caseTypes", "caseStatuses", "states",
        "filingDateFrom", "filingDateTo", "decisionDateFrom", "decisionDateTo",
        "page", "pageSize", "sortBy", "sortOrder",
      ];
      for (const k of allowed) {
        const v = body[k];
        if (v == null || v === "") continue;
        if (Array.isArray(v)) v.forEach((x) => params.append(k, String(x)));
        else params.set(k, String(v));
      }
      if (!params.has("pageSize")) params.set("pageSize", "20");
      url = `${BASE}/api/partner/search?${params.toString()}`;
    } else if (action === "case") {
      const cnr = String(body.cnr || "").trim().toUpperCase();
      if (!/^[A-Z]{4}\d{12}$/.test(cnr)) {
        return json({ error: "Invalid CNR. Expected 16 chars: 4 letters + 12 digits." }, 400);
      }
      url = `${BASE}/api/partner/case/${cnr}`;
    } else if (action === "causelist") {
      const params = new URLSearchParams();
      for (const k of ["date", "courtCode", "judge", "advocate", "litigant", "state", "district", "page", "pageSize"]) {
        const v = body[k];
        if (v != null && v !== "") params.set(k, String(v));
      }
      url = `${BASE}/api/partner/causelist/search?${params.toString()}`;
    } else if (action === "available-dates") {
      const params = new URLSearchParams();
      for (const k of ["state", "district", "courtCode", "complexCode"]) {
        const v = body[k];
        if (v != null && v !== "") params.set(k, String(v));
      }
      url = `${BASE}/api/partner/causelist/available-dates?${params.toString()}`;
    } else {
      return json({ error: "Unknown action. Use: search | case | causelist | available-dates" }, 400);
    }

    const r = await fetch(url, init);
    const text = await r.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!r.ok) {
      return json({ error: `eCourts API ${r.status}`, details: data }, r.status);
    }
    return json(data, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
