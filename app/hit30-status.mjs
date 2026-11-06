export const hit30CallsUrl = "https://hit30.sanayi.gov.tr/cagrilar";

const topics = {
  vehicles: { anchor: "area1", labels: ["hit-electric vehicles", "hit-elektrikli araç"] },
  battery: { anchor: "area2", labels: ["hit-battery", "hit-batarya"] },
  wind: { anchor: "area5", labels: ["hit-wind", "hit-rüzgâr", "hit-rüzgar"] },
};
const plain = text => text.replace(/<[^>]*>/g, " ").replace(/&#x([0-9a-f]{2,4});/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&#(\d{2,5});/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").trim().toLowerCase();

export function readHit30Statuses(html) {
  const cards = [...html.matchAll(/<a\b[^>]*\shref\s*=\s*["']\/cagrilar#(area\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  return Object.fromEntries(Object.entries(topics).map(([key, {anchor, labels}]) => {
    const matches = cards.filter(([, target]) => target === anchor);
    if (matches.length !== 1) return [key, "unknown"];
    const markup = matches[0][2];
    const label = plain(markup.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
    if (!labels.includes(label)) return [key, "unknown"];
    const state = plain(markup);
    if (/this call has ended|bu çağrı sona ermiştir|bu çağrı sona erdi|çağrı kapanmıştır/.test(state)) return [key, "archived"];
    // An unexpected status label is not proof that a call is still open.
    if (state !== label) return [key, "unknown"];
    return [key, "open"];
  }));
}

export function observedHit30Status(observation, key, now) {
  const status = observation?.hit30Statuses?.[key];
  const checked = Date.parse(observation?.checkedAt ?? "");
  if (status === "archived") return "archived";
  if (!observation?.ok || !Number.isFinite(checked) || checked > now || now - checked > 48 * 3600000) return "unknown";
  return status === "open" ? "open" : "unknown";
}
