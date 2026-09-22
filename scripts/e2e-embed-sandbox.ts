import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const parentServer = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://parent.invalid");
  const childPort = requestUrl.searchParams.get("child");
  const fixture = requestUrl.searchParams.get("fixture") === "broken" ? "broken" : "compatible";
  if (!childPort || !/^\d+$/u.test(childPort)) {
    response.writeHead(400).end("missing child port");
    return;
  }
  response
    .writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" })
    .end(parentHtml(Number(childPort), fixture));
});

const childServer = createServer((request, response) => {
  const fixture = request.url === "/broken" ? "broken" : "compatible";
  response
    .writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" })
    .end(childHtml(fixture));
});

function parentHtml(childPort: number, fixture: "compatible" | "broken"): string {
  return `<!doctype html>
<html><head><title>pending</title></head><body>
<div id="result" data-e2e-result="pending">pending</div>
<iframe id="embed" sandbox="allow-scripts"></iframe>
<script>
  const result = document.getElementById("result");
  const embed = document.getElementById("embed");
  window.addEventListener("message", (event) => {
    if (event.data?.type !== "sandbox-e2e-pass") return;
    result.dataset.e2eResult = "pass";
    result.textContent = "pass";
    document.title = "pass";
  });
  embed.src = "http://127.0.0.1:${childPort}/${fixture}";
  setTimeout(() => {
    if (result.dataset.e2eResult === "pending") {
      result.dataset.e2eResult = "failed";
      result.textContent = "failed";
      document.title = "failed";
    }
  }, 1500);
</script>
</body></html>`;
}

function childHtml(fixture: "compatible" | "broken"): string {
  const storageAccess =
    fixture === "broken"
      ? `sessionStorage.setItem("sandbox-e2e", "broken");`
      : `try { sessionStorage.setItem("sandbox-e2e", "safe"); } catch { /* memory fallback */ }`;
  return `<!doctype html>
<html><body>
<button id="advance" type="button">Advance</button>
<output id="step">Step 1</output>
<script>
  ${storageAccess}
  const button = document.getElementById("advance");
  button.addEventListener("click", () => {
    document.getElementById("step").textContent = "Step 2";
    const announcePass = () => parent.postMessage({ type: "sandbox-e2e-pass" }, "*");
    announcePass();
    setTimeout(announcePass, 50);
    setTimeout(announcePass, 150);
    setTimeout(announcePass, 300);
  });
  button.click();
</script>
</body></html>`;
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("E2E server has no TCP port.");
  return address.port;
}

function findChrome(): string {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "chromium",
    "chromium-browser",
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    if (candidate.startsWith("/")) {
      const result = spawnSync("test", ["-x", candidate]);
      if (result.status === 0) return candidate;
      continue;
    }
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Chrome or Chromium is required for the sandbox E2E test.");
}

async function dumpDom(chrome: string, url: string, profileDirectory: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(chrome, [
      "--headless=new",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-gpu",
      "--disable-sync",
      "--metrics-recording-only",
      "--mute-audio",
      "--no-default-browser-check",
      "--no-first-run",
      "--no-sandbox",
      `--user-data-dir=${profileDirectory}`,
      "--virtual-time-budget=3000",
      "--dump-dom",
      url,
    ]);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Chrome exited with ${code}: ${stderr.slice(-2_000)}`));
    });
  });
}

function assertIncludes(value: string, expected: string, message: string): void {
  if (!value.includes(expected)) throw new Error(`E2E failed: ${message}`);
}

async function run(): Promise<void> {
  const chrome = findChrome();
  const profileRoot = await mkdtemp(join(tmpdir(), "publisher-embed-e2e-"));
  try {
    const [parentPort, childPort] = await Promise.all([listen(parentServer), listen(childServer)]);
    const baseUrl = `http://127.0.0.1:${parentPort}/?child=${childPort}`;
    const compatible = await dumpDom(
      chrome,
      `${baseUrl}&fixture=compatible`,
      join(profileRoot, "ok"),
    );
    assertIncludes(compatible, 'sandbox="allow-scripts"', "the exact sandbox profile is absent");
    if (compatible.includes("allow-same-origin")) {
      throw new Error("E2E failed: allow-same-origin must never be enabled");
    }
    assertIncludes(
      compatible,
      'data-e2e-result="pass"',
      "the storage-safe interactive embed did not complete",
    );

    const broken = await dumpDom(chrome, `${baseUrl}&fixture=broken`, join(profileRoot, "broken"));
    assertIncludes(
      broken,
      'data-e2e-result="failed"',
      "the unsafe sessionStorage fixture was not rejected",
    );
    console.log("Cross-origin allow-scripts embed sandbox E2E passed.");
  } finally {
    parentServer.close();
    childServer.close();
    await rm(profileRoot, { recursive: true, force: true });
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
