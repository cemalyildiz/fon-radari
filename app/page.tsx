import CallsExplorer from "./CallsExplorer";
import { calls } from "./calls-data";
import { readFile } from "node:fs/promises";
import type { FundingCall } from "./calls-data";

export default async function Home() {
  const feed = await readFile('public/national-calls.json', 'utf8').then(JSON.parse).catch(() => ({ calls: [] }));
  return <><aside style={{padding:'12px 24px',background:'#eef4f0'}}>Ulusal kaynak taraması: {Object.entries(feed.sources ?? {}).map(([name, value]) => { const s = value as {ok:boolean;checkedAt?:string}; return `${name}: ${s.ok ? 'kontrol edildi' : 'erişim sorunu'}${s.checkedAt ? ` (${new Date(s.checkedAt).toLocaleString('tr-TR', {timeZone:'Europe/Istanbul'})})` : ''}`; }).join(' · ')}. Otomatik keşfedilen duyurular için “Tüm durumlar” filtresini kullanın.</aside><CallsExplorer calls={[...calls, ...feed.calls as FundingCall[]]} /></>;
}
