import { spawn } from "node:child_process";
import { readFile, writeFile, rename } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";

const target = "public/live-calls.json";
function runWorker() {
  return new Promise((resolve, reject) => {
    // A native HTTP parser assertion can terminate Node outside try/catch.
    // Keep the network operation in a separate process so recovery still runs.
    const child = spawn(process.execPath, [fileURLToPath(new URL("./update-live-calls.mjs", import.meta.url))], {
      stdio: "inherit", timeout: 300_000, killSignal: "SIGKILL",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Refresh worker exited: ${signal ?? code}`)));
  });
}
export async function supervise({ path = target, run = runWorker, pause = ms => new Promise(r => setTimeout(r, ms)), now = () => new Date().toISOString() } = {}) {
  const previous = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(previous.calls) || !previous.calls.length || !Number.isFinite(Date.parse(previous.checkedAt))) {
    throw new Error("No valid previous feed; refusing to publish an empty fallback");
  }
  const attemptedAt = now();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await run();
      const current = JSON.parse(await readFile(path, "utf8"));
      if (current.degraded || !current.calls?.length || !(Date.parse(current.checkedAt) >= Date.parse(attemptedAt))) {
        throw new Error("Worker did not produce a fresh successful feed");
      }
      return { degraded: false, attempts: attempt };
    } catch (error) {
      console.warn(`Refresh attempt ${attempt}/3 failed: ${error.message}`);
      if (attempt < 3) await pause(attempt * 10_000);
    }
  }
  // Restore the pre-run snapshot, including the last successful timestamp.
  await writeFile(`${path}.recovery.tmp`, `${JSON.stringify({ ...previous, attemptedAt, degraded: true }, null, 2)}\n`);
  await rename(`${path}.recovery.tmp`, path);
  console.warn("::warning::Call source unavailable after three attempts. Publishing last successful data with a visible update warning.");
  return { degraded: true, attempts: 3 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await supervise();
