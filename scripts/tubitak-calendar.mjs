export const calendarIndex = 'https://tubitak.gov.tr/tr/acik-cagrilar';
const origin = new URL(calendarIndex).origin;
const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const text = s => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g,' ').replace(/\s+/g, ' ').trim();
const code = s => text(s).match(/^#?\s*(\d{4})\s+(20\d{2})\s*[-/]\s*(\d{1,2})$/)?.slice(1).join('-');

export function calendarDetailUrl(value) {
  try {
    const u = new URL(value, origin);
    if (u.origin !== origin || u.username || u.password || u.search || u.hash) return;
    if (/^\/tr\/destekler\/destek\/sanayi\/ulusal-destek-programlari\/cagri-[a-z0-9-]+$/.test(u.pathname)) return u.href;
  } catch {
    // Invalid URLs cannot identify an official call.
  }
}

function dateRange(html) {
  const tags = [...html.matchAll(/<time\b[^>]*\bdatetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/gi)];
  if (tags.length !== 2) return;
  const dates = tags.map(([, raw, label]) => {
    if (!/^20\d{2}-\d\d-\d\dT\d\d:\d\d:00Z$/.test(raw)) return;
    const epoch = Date.parse(raw);
    if (!Number.isFinite(epoch) || new Date(epoch).toISOString().replace('.000Z','Z') !== raw) return;
    const local = new Date(epoch + 3 * 3600000).toISOString();
    const shown = `${local.slice(8,10)} ${months[Number(local.slice(5,7))-1]} ${local.slice(0,4)} - ${local.slice(11,16)}`;
    return shown === text(label) ? raw : undefined;
  });
  if (dates.some(d => !d)) return;
  const [openDate, deadline] = dates;
  const duration = Date.parse(deadline) - Date.parse(openDate);
  if (duration > 0 && duration <= 366 * 86400000) return {openDate, deadline};
}

export function extractCalendarIndex(html) {
  const rows = new Map();
  const duplicates = new Set();
  for (const row of html.split(/<div\s+class=["']views-row["'][^>]*>/i).slice(1)) {
    const head = row.match(/<div class="c-baslik">\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/div>/i);
    const rawCode = row.match(/<div class="c-kodu">([\s\S]*?)<\/div>/i)?.[1];
    const block = row.match(/<span class="views-label views-label-field-basvuru-araligi">Başvuru aralığı<\/span>\s*<div class="field-content">([\s\S]*?)<\/div>/i)?.[1];
    if (!head || !rawCode || !block) continue;
    const key = code(rawCode);
    const sourceUrl = calendarDetailUrl(head[1]);
    const title = text(head[2]);
    const dates = dateRange(block);
    if (!key || !sourceUrl || !title || !dates || !title.startsWith(key.slice(0,4))) continue;
    if (rows.has(key)) duplicates.add(key);
    else rows.set(key,{key,sourceUrl,title,...dates});
  }
  return [...rows.values()].filter(row => !duplicates.has(row.key));
}

export function confirmCalendarDetail(row, html) {
  const rawCode = html.match(/<div class="field__label">Çağrı kodu<\/div>\s*<div class="field__item">([\s\S]*?)<\/div>/i)?.[1];
  const block = html.match(/<div class="field__label">Başvuru aralığı<\/div>\s*<div class="field__item">([\s\S]*?)<\/div>/i)?.[1];
  if (!rawCode || !block || code(rawCode) !== row.key) return false;
  const dates = dateRange(block);
  return dates?.openDate === row.openDate && dates?.deadline === row.deadline;
}
