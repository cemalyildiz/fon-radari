const amount = value => {
  if (typeof value !== "number" && !(typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value))) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER ? n : null;
};

export function officialConditionDocument(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.origin !== "https://ec.europa.eu" || url.username || url.password
      || !url.pathname.startsWith("/info/funding-tenders/opportunities/docs/") || !/\.pdf$/i.test(url.pathname)) return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export function extractTopicEvidence(metadata, identifier) {
  const links = new Set();
  const conditions = metadata.topicConditions?.[0];
  if (typeof conditions === "string") {
    for (const match of conditions.slice(0, 250_000).matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
      const url = officialConditionDocument(match[1]);
      if (url) links.add(url);
      if (links.size >= 10) break;
    }
  }
  const conditionDocuments = [...links];
  const result = conditionDocuments.length ? { conditionDocuments } : {};
  // Horizon's work programmes report these amounts in EUR. Other programmes
  // are not inferred from this schema, and unmatched group budgets are not copied.
  if (!Array.isArray(metadata.frameworkProgramme) || !metadata.frameworkProgramme.includes("43108390") || !/^HORIZON-/i.test(identifier)) return result;
  const raw = metadata.budgetOverview?.[0];
  if (typeof raw !== "string" || raw.length > 1_000_000) return result;
  let map;
  try { map = JSON.parse(raw)?.budgetTopicActionMap; } catch { return result; }
  if (!map || typeof map !== "object" || Array.isArray(map)) return result;
  const candidates = [];
  for (const group of Object.values(map)) {
    if (!Array.isArray(group)) continue;
    for (const row of group) {
      if (typeof row?.action !== "string" || row.action.length > 350) continue;
      const [code, ...actionParts] = row.action.split(" - ");
      if (code.trim().toLowerCase() !== identifier.toLowerCase()) continue;
      const action = actionParts.join(" - ").trim();
      if (!action) continue;
      const yearly = {};
      if (group.length === 1 && row.budgetYearMap && typeof row.budgetYearMap === "object" && !Array.isArray(row.budgetYearMap)) {
        for (const [year, rawAmount] of Object.entries(row.budgetYearMap).sort(([a],[b]) => a.localeCompare(b))) {
          const value = amount(rawAmount);
          if (/^20\d\d$/.test(year) && value !== null) yearly[year] = value;
        }
      }
      const min = amount(row.minContribution);
      const max = amount(row.maxContribution);
      const grants = Number.isSafeInteger(row.expectedGrants) && row.expectedGrants > 0 ? row.expectedGrants : null;
      if (min !== null && max !== null && min > max) continue;
      if (!Object.keys(yearly).length && min === null && max === null && grants === null) continue;
      candidates.push({ action, yearly, min, max, grants });
    }
  }
  const sourceBudget = mergeTopicBudgets([], candidates);
  if (sourceBudget === null) return { ...result, sourceBudgetConflict: true };
  return sourceBudget.length ? { ...result, sourceBudget } : result;
}

export function mergeTopicBudgets(left, right) {
  const byAction = new Map();
  for (const row of [...left, ...right]) {
    const key = row.action.toLowerCase();
    if (!byAction.has(key)) byAction.set(key, row);
    else if (JSON.stringify(byAction.get(key)) !== JSON.stringify(row)) return null;
  }
  return [...byAction.values()].sort((a,b)=>a.action.localeCompare(b.action)).slice(0, 8);
}

export function validBudgetRow(value) {
  if (!value || typeof value.action !== "string" || !value.action.trim() || value.action.length > 350
    || !value.yearly || typeof value.yearly !== "object" || Array.isArray(value.yearly)) return false;
  const validAmount = n => typeof n === "number" && amount(n) !== null;
  return Object.entries(value.yearly).every(([year, n]) => /^20\d\d$/.test(year) && validAmount(n))
    && (value.min === null || validAmount(value.min))
    && (value.max === null || validAmount(value.max))
    && (value.min === null || value.max === null || value.min <= value.max)
    && (value.grants === null || (Number.isSafeInteger(value.grants) && value.grants > 0));
}
