import { fetchWithTimeout, sendJson } from "./_shared";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const requestUrl = new URL(req.url || "/api/proxy-sheet", `https://${req.headers.host || "localhost"}`);
  const sheetId = String(requestUrl.searchParams.get("id") || "").trim();
  const gid = String(requestUrl.searchParams.get("gid") || "").trim();

  if (!sheetId) return sendJson(res, 400, { error: "Missing sheet ID" });
  if (!/^[a-zA-Z0-9-_]+$/.test(sheetId)) {
    return sendJson(res, 400, { error: "Invalid Google Sheet ID. Paste the spreadsheet URL or the ID from /spreadsheets/d/{id}." });
  }
  if (gid && !/^\d+$/.test(gid)) {
    return sendJson(res, 400, { error: "Invalid Google Sheet gid. It should be a numeric tab ID." });
  }

  try {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ""}`;

    let upstream = await fetchWithTimeout(exportUrl, 15000);
    if (!upstream.ok && upstream.status >= 400) {
      upstream = await fetchWithTimeout(gvizUrl, 15000);
    }

    const csvText = await upstream.text();
    if (!upstream.ok) {
      return sendJson(res, upstream.status === 404 ? 404 : 502, {
        error: upstream.status === 404
          ? "Google Sheet not found. Please verify the URL and ensure the sheet still exists."
          : `Google Sheets returned ${upstream.status}. Ensure the sheet is shared as "Anyone with the link can view".`
      });
    }

    if (/^\s*</.test(csvText)) {
      return sendJson(res, 403, { error: "Sheet not public. Share the responses spreadsheet as \"Anyone with the link can view\" and sync again." });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(csvText);
  } catch (err: any) {
    const message = err?.name === "AbortError" ? "Timed out fetching Google Sheet." : (err?.message || String(err));
    return sendJson(res, 502, { error: "Network error fetching sheet: " + message });
  }
}
