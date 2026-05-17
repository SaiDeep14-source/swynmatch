export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const sheetId = req.query.id;
  const gid = req.query.gid;
  if (!sheetId) return res.status(400).json({ error: "Missing sheet ID" });

  try {
    const targetUrl = `https://docs.google.com/spreadsheets/d/${sheetId.replace(/\s+/g, '')}/export?format=csv${gid ? `&gid=${gid.replace(/\s+/g, '')}` : ''}`;
    
    const response = await fetch(targetUrl);
    const csvText = await response.text();

    if (typeof csvText === 'string' && csvText.trim().startsWith('<')) {
       return res.status(401).json({ error: "Sheet not public (Anyone with link can view required)" });
    }
    
    if (!response.ok) {
        if (response.status === 404) {
            return res.status(404).json({ error: "Google Sheet not found. Please verify the URL and ensure the sheet still exists." });
        }
        return res.status(response.status).json({ error: `Network error fetching sheet (Status: ${response.status})` });
    }

    return res.status(200).send(csvText);
  } catch (err: any) {
    return res.status(500).json({ error: "Internal error checking sheet: " + err.message });
  }
}
