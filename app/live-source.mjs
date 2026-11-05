const PORTAL = "/info/funding-tenders/opportunities/portal/screen/opportunities/";

// Use the record's own official destination rather than assuming every item is a topic.
export function officialDestination(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.origin === "https://webgate.ec.europa.eu" && url.pathname === "/prospect/external/publishedcalls.htm") {
      const id = url.searchParams.get("callId");
      return id && /^\d+$/.test(id) ? { kind: "external", id, url: `https://webgate.ec.europa.eu/prospect/external/publishedcalls.htm?callId=${id}` } : null;
    }
    if (url.origin !== "https://ec.europa.eu") return null;
    const path = url.pathname;
    if (path.startsWith(PORTAL)) {
      const route = path.slice(PORTAL.length);
      const cascade = /^competitive-calls-cs\/(\d+)\/?$/.exec(route);
      if (cascade) return { kind: "cascade", id: cascade[1], url: `${url.origin}${PORTAL}competitive-calls-cs/${cascade[1]}` };
      const topic = /^topic-details\/([a-z0-9][a-z0-9_.-]*)\/?$/i.exec(route);
      if (topic) {
        const external = /^(\d+)PROSPECT[A-Z]*$/i.exec(topic[1]);
        return { kind: external ? "external" : "topic", id: external?.[1] ?? topic[1], url: `${url.origin}${PORTAL}topic-details/${topic[1]}` };
      }
    }
    const data = /^\/info\/funding-tenders\/opportunities\/data\/topicDetails\/([a-z0-9][a-z0-9_.-]*)\.json$/i.exec(path);
    if (data) return { kind: "topic", id: data[1], url: `${url.origin}${PORTAL}topic-details/${data[1]}` };
  } catch {
    return null;
  }
  return null;
}

export function destinationIdentifier(destination, recordId) {
  return destination.kind === "topic" ? destination.id
    : destination.kind === "cascade" ? `cascade-${destination.id}-${recordId}` : `europeaid-${destination.id}`;
}
