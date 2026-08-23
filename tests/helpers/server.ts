import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export interface TestServer {
  baseUrl: string;
  stop: () => Promise<void>;
}

/** Asks the OS for an unused port so parallel test files cannot collide. */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Boots the real `server.ts` as a child process and waits for it to listen.
 *
 * Spawning the actual entry point (rather than importing an app factory) is
 * deliberate: it is the only way to catch boot-time failures such as an
 * Express 5 route pattern the router rejects.
 */
export async function startTestServer(
  env: Record<string, string> = {},
  { timeoutMs = 60_000 }: { timeoutMs?: number } = {},
): Promise<TestServer> {
  const port = await getFreePort();

  const child: ChildProcessByStdio<null, Readable, Readable> = spawn(
    "npx",
    ["tsx", "server.ts"],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(port),
        // Keep tests hermetic: never inherit a developer's real credentials.
        GEMINI_API_KEY: "",
        NVIDIA_API_KEY: "",
        HF_TOKEN: "",
        DEMO_MODE: "",
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";
  const collect = (chunk: Buffer) => {
    output += chunk.toString();
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      const force = setTimeout(() => child.kill("SIGKILL"), 5_000);
      child.once("exit", () => {
        clearTimeout(force);
        resolve();
      });
      child.kill("SIGTERM");
    });
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error(`server did not start within ${timeoutMs}ms:\n${output}`)),
        timeoutMs,
      );
      const check = () => {
        if (output.includes("Server running on")) {
          clearTimeout(deadline);
          resolve();
        }
      };
      child.stdout.on("data", check);
      child.stderr.on("data", check);
      child.once("exit", (code) => {
        clearTimeout(deadline);
        reject(new Error(`server exited early with code ${code}:\n${output}`));
      });
      check();
    });
  } catch (err) {
    await stop();
    throw err;
  }

  return { baseUrl: `http://127.0.0.1:${port}`, stop };
}

/** Parses a CSP header into `{ directive: [values] }`. */
export function parseCsp(header: string | null): Record<string, string[]> {
  const directives: Record<string, string[]> = {};
  for (const part of (header ?? "").split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) directives[name.toLowerCase()] = values;
  }
  return directives;
}

export function postRecommend(baseUrl: string, body: unknown) {
  return fetch(`${baseUrl}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
