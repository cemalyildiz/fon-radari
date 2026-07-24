import CallsExplorer from "./CallsExplorer";
import { calls } from "./calls-data";

export default function Home() {
  return <CallsExplorer calls={calls} />;
}
