import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = (process.env.E2E_BASE_URL ?? "http://localhost:8788").replace(/\/$/u, "");
const authSession = `creator-accessibility-${Date.now().toString(36)}`;
const creatorProfileId = `github:e2e-accessibility-${Date.now().toString(36)}`;
const embedUrl = "https://e2e-browser.example.com/embed";

if (!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/u.test(baseUrl)) {
  throw new Error("Refusing to run the browser E2E flow against a non-local URL.");
}

type CdpEventHandler = (params: Record<string, unknown>) => void | Promise<void>;

class CdpClient {
  private readonly socket: WebSocket;
  private readonly pending = new Map<
    number,
    { reject: (error: Error) => void; resolve: (value: unknown) => void; timer: NodeJS.Timeout }
  >();
  private readonly handlers = new Map<string, Set<CdpEventHandler>>();
  private nextId = 1;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => void this.handleMessage(event.data));
    socket.addEventListener("close", () => {
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(new Error("Chrome DevTools connection closed unexpectedly."));
      }
      this.pending.clear();
    });
  }

  static async connect(url: string): Promise<CdpClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to Chrome.")), 10_000);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Could not connect to Chrome DevTools."));
      });
    });
    return new CdpClient(socket);
  }

  on(method: string, handler: CdpEventHandler): void {
    const handlers = this.handlers.get(method) ?? new Set<CdpEventHandler>();
    handlers.add(handler);
    this.handlers.set(method, handlers);
  }

  async send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const id = this.nextId++;
    const response = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome DevTools command timed out: ${method}`));
      }, 10_000);
      this.pending.set(id, {
        reject,
        resolve: (value) => resolve(value as T),
        timer,
      });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return response;
  }

  close(): void {
    this.socket.close();
  }

  private async handleMessage(data: string | ArrayBuffer | Blob): Promise<void> {
    const text =
      typeof data === "string"
        ? data
        : data instanceof Blob
          ? await data.text()
          : Buffer.from(data).toString("utf8");
    const message = JSON.parse(text) as {
      id?: number;
      method?: string;
      params?: Record<string, unknown>;
      result?: unknown;
      error?: { message?: string };
    };
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(new Error(message.error.message ?? "Chrome DevTools command failed."));
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (!message.method) return;
    for (const handler of this.handlers.get(message.method) ?? []) {
      Promise.resolve(handler(message.params ?? {})).catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
      });
    }
  }
}

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function seedCreatorSession(): void {
  const tokenHash = createHash("sha256").update(authSession).digest("base64url");
  const sessionId = `e2e-accessibility-${Date.now().toString(36)}`;
  const command = `
    INSERT INTO profiles (id, role, display_name, website_url, created_at)
    VALUES (${sql(creatorProfileId)}, 'creator', 'E2E Accessibility Creator',
      'https://example.com', '2026-09-15T00:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET
      role = excluded.role, display_name = excluded.display_name,
      website_url = excluded.website_url;
    INSERT INTO auth_sessions (id, profile_id, token_hash, expires_at, created_at)
    VALUES (${sql(sessionId)}, ${sql(creatorProfileId)}, ${sql(tokenHash)},
      '2099-01-01T00:00:00.000Z', '2026-09-15T00:00:00.000Z');
  `;
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["wrangler", "d1", "execute", "DB", "--local", "--command", command],
    { stdio: "pipe" },
  );
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
      if (spawnSync("test", ["-x", candidate]).status === 0) return candidate;
      continue;
    }
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Chrome or Chromium is required for the submission accessibility E2E test.");
}

function launchChrome(
  chrome: string,
  profileDirectory: string,
  debugPort: number,
): {
  child: ChildProcessWithoutNullStreams;
  stderr: () => string;
} {
  const child = spawn(chrome, [
    "--headless=new",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-sync",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-first-run",
    "--no-sandbox",
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${debugPort}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ]);
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => (stderr += chunk));
  return { child, stderr: () => stderr };
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a TCP port.");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function pageWebSocketUrl(port: number): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = (await response.json()) as Array<{
          type?: string;
          webSocketDebuggerUrl?: string;
        }>;
        const page = targets.find(
          (target) => target.type === "page" && typeof target.webSocketDebuggerUrl === "string",
        );
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome starts listening asynchronously.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Chrome did not expose a page target.");
}

async function evaluate<T>(client: CdpClient, expression: string): Promise<T> {
  const response = await client.send<{
    result?: { value?: T; description?: string };
    exceptionDetails?: { text?: string };
  }>("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    throw new Error(
      `Browser evaluation failed: ${response.exceptionDetails.text ?? response.result?.description}`,
    );
  }
  return response.result?.value as T;
}

async function waitFor<T>(
  client: CdpClient,
  expression: string,
  predicate: (value: T) => boolean,
  description: string,
): Promise<T> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = await evaluate<T>(client, expression);
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`E2E failed: timed out waiting for ${description}.`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`E2E failed: ${message}`);
}

async function stopChrome(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("close", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function run(): Promise<void> {
  seedCreatorSession();
  const profileDirectory = await mkdtemp(join(tmpdir(), "citesupply-submission-a11y-"));
  const debugPort = await reservePort();
  const launched = launchChrome(findChrome(), profileDirectory, debugPort);
  let client: CdpClient | null = null;
  try {
    client = await CdpClient.connect(await pageWebSocketUrl(debugPort));
    await Promise.all([
      client.send("Page.enable"),
      client.send("Runtime.enable"),
      client.send("Network.enable"),
      client.send("Fetch.enable", { patterns: [{ urlPattern: embedUrl }] }),
    ]);
    client.on("Fetch.requestPaused", async (params) => {
      const requestId = String(params.requestId ?? "");
      const request = params.request as { url?: string } | undefined;
      if (request?.url === embedUrl) {
        await client?.send("Fetch.fulfillRequest", {
          requestId,
          responseCode: 200,
          responseHeaders: [
            { name: "Content-Type", value: "text/html; charset=utf-8" },
            { name: "Cache-Control", value: "no-store" },
          ],
          body: Buffer.from("<!doctype html><title>Embed fixture</title><p>Ready</p>").toString(
            "base64",
          ),
        });
      } else {
        await client?.send("Fetch.continueRequest", { requestId });
      }
    });
    await client.send("Network.setCookie", {
      name: "publisher_asset_session",
      value: authSession,
      url: baseUrl,
      httpOnly: true,
      sameSite: "Lax",
    });
    await client.send("Page.navigate", { url: `${baseUrl}/submit` });
    await waitFor<boolean>(
      client,
      `document.readyState === "complete" && Boolean(document.querySelector("form.submission-form"))`,
      Boolean,
      "the hydrated submission form",
    );

    const formFilled = await evaluate<boolean>(
      client,
      `(() => {
        const form = document.querySelector("form.submission-form");
        if (!(form instanceof HTMLFormElement)) return false;
        const setValue = (name, value) => {
          const control = form.elements.namedItem(name);
          if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) return false;
          const prototype = control instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : control instanceof HTMLSelectElement
              ? HTMLSelectElement.prototype
              : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
          if (!setter) return false;
          setter.call(control, value);
          control.dispatchEvent(new Event("input", { bubbles: true }));
          control.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        };
        const values = ${JSON.stringify({
          canonical_url: "https://e2e-browser.example.com/asset",
          asset_type: "chart",
          title: "<b>Accessible browser test</b>",
          description: "A browser test asset that verifies accessible server-side validation.",
          embed_url: embedUrl,
          preview_url: "https://e2e-browser.example.com/preview.png",
          attribution_name: "E2E Browser Source",
          attribution_url: "https://e2e-browser.example.com/terms",
          attribution_terms: "Credit E2E Browser Source — CC BY 4.0",
        })};
        return Object.entries(values).every(([name, value]) => setValue(name, value));
      })()`,
    );
    assert(formFilled, "the browser could not fill the submission form");

    const embedTestStarted = await evaluate<boolean>(
      client,
      `(() => {
        const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === "Test embed");
        if (!(button instanceof HTMLButtonElement)) return false;
        button.click();
        return true;
      })()`,
    );
    assert(embedTestStarted, "the sandbox test button was not found");
    await waitFor<boolean>(
      client,
      `(() => {
        const checkbox = document.querySelector('input[name="sandbox_compatible"]');
        return checkbox instanceof HTMLInputElement && !checkbox.disabled;
      })()`,
      Boolean,
      "the sandbox fixture to load",
    );

    const submitted = await evaluate<boolean>(
      client,
      `(() => {
        const form = document.querySelector("form.submission-form");
        if (!(form instanceof HTMLFormElement)) return false;
        for (const checkbox of form.querySelectorAll('input[type="checkbox"]')) {
          if (checkbox instanceof HTMLInputElement && !checkbox.disabled && !checkbox.checked) checkbox.click();
        }
        form.requestSubmit();
        return true;
      })()`,
    );
    assert(submitted, "the browser could not submit the form");

    type AccessibilityState = {
      activeName: string | null;
      describedBy: string | null;
      errorText: string | null;
      invalid: string | null;
      retainedDescription: string;
      summaryText: string | null;
    };
    const state = await waitFor<AccessibilityState>(
      client,
      `(() => {
        const title = document.querySelector('input[name="title"]');
        const summary = [...document.querySelectorAll('[role="alert"]')].find((node) => node.textContent?.includes("Please correct the highlighted fields."));
        const description = document.querySelector('textarea[name="description"]');
        return {
          activeName: document.activeElement?.getAttribute("name") ?? null,
          describedBy: title?.getAttribute("aria-describedby") ?? null,
          errorText: document.querySelector("#title-error")?.textContent?.trim() ?? null,
          invalid: title?.getAttribute("aria-invalid") ?? null,
          retainedDescription: description instanceof HTMLTextAreaElement ? description.value : "",
          summaryText: summary?.textContent?.replace(/\\s+/g, " ").trim() ?? null,
        };
      })()`,
      (value) => value.errorText !== null,
      "the server validation error",
    );
    assert(state.activeName === "title", "focus did not move to the first invalid field");
    assert(state.invalid === "true", "the invalid title is missing aria-invalid=true");
    assert(
      state.describedBy?.split(/\s+/u).includes("title-error"),
      "the title is not associated with its field error",
    );
    assert(state.errorText === "Raw HTML is not allowed.", "the field error is not specific");
    assert(
      state.summaryText?.includes("Please correct the highlighted fields.") &&
        state.summaryText.includes("Raw HTML is not allowed."),
      "the alert summary does not contain the server error",
    );
    assert(
      state.retainedDescription ===
        "A browser test asset that verifies accessible server-side validation.",
      "the form did not retain entered values after the server error",
    );

    await evaluate(
      client,
      `(() => {
        const title = document.querySelector('input[name="title"]');
        if (!(title instanceof HTMLInputElement)) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(title, "Accessible browser test");
        title.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`,
    );
    await waitFor<boolean>(
      client,
      `(() => {
        const title = document.querySelector('input[name="title"]');
        const summary = [...document.querySelectorAll('[role="alert"]')].find((node) => node.textContent?.includes("Please correct the highlighted fields."));
        return Boolean(title) && !title.hasAttribute("aria-invalid") && !title.hasAttribute("aria-describedby") && !document.querySelector("#title-error") && !summary;
      })()`,
      Boolean,
      "the corrected field to clear its accessible error state",
    );

    console.log("Submission server-error accessibility browser E2E passed.");
  } catch (error) {
    const diagnostic = launched.stderr().slice(-2_000);
    if (diagnostic) console.error(`Chrome diagnostics:\n${diagnostic}`);
    throw error;
  } finally {
    client?.close();
    await stopChrome(launched.child);
    await rm(profileDirectory, { recursive: true, force: true });
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
