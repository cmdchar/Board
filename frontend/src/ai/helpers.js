import { FILE_TEMPLATE_KEYS } from "./prompts";

export async function aiCall(msg, sys) {
  const response = await fetch("/api/ai/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt: sys, userPrompt: msg, maxTokens: 1400 }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `AI request failed (${response.status})`);
  if (payload.json && typeof payload.json === "object") return payload.json;
  if (typeof payload.text !== "string" || !payload.text.trim()) throw new Error("AI returned empty response");
  return payload.text;
}

export function parseAiJson(raw) {
  if (raw && typeof raw === "object") return raw;
  const txt = String(raw || "").trim();
  const unfenced = txt
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const normalize = s =>
    String(s || "")
      .replace(/[\u201C\u201D]/g, "\"")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
      .trim();
  const candidates = [unfenced];
  const i = unfenced.indexOf("{");
  const j = unfenced.lastIndexOf("}");
  if (i !== -1 && j > i) candidates.push(unfenced.slice(i, j + 1));
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {}
    const n = normalize(c);
    if (n !== c) {
      try {
        return JSON.parse(n);
      } catch {}
    }
  }
  throw new Error("AI a returnat JSON invalid");
}

const asTemplate = v => (FILE_TEMPLATE_KEYS.includes(v) ? v : "custom");

export function normalizeTemplatePlan(raw) {
  const p = parseAiJson(raw);
  const rec = asTemplate(String(p.recommendedTemplate || "").trim());
  const needsTable = Boolean(p.needsTable);
  const alts = (Array.isArray(p.alternatives) ? p.alternatives : [])
    .map(v => asTemplate(String(v || "").trim()))
    .filter(v => v !== "custom");
  const options = [rec, ...alts, needsTable ? "table" : null, "custom"]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 6);
  return {
    recommended: rec,
    options,
    reason: typeof p.reason === "string" ? p.reason : "",
    complexity: ["low", "medium", "high"].includes(p.complexity) ? p.complexity : "medium",
    needsTable,
    tableReason: typeof p.tableReason === "string" ? p.tableReason : "",
    selected: null,
  };
}

export function buildFileGenerationPrompt(draft, plan, templateId) {
  const t = FILE_TEMPLATE_KEYS.includes(templateId) ? templateId : (plan?.recommended || "custom");
  return [
    `Fisier: "${draft.name}"`,
    `Template ales: ${t}`,
    `Complexity hint: ${plan?.complexity || "medium"}`,
    `needsTable: ${plan?.needsTable ? "true" : "false"}`,
    plan?.reason ? `Motiv template: ${plan.reason}` : "",
    plan?.needsTable && plan?.tableReason ? `Motiv tabel: ${plan.tableReason}` : "",
    "",
    draft.content,
  ]
    .filter(Boolean)
    .join("\n");
}
