/**
 * sandbox-network-shim.cjs
 *
 * WHY THIS EXISTS — AND WHY IT MUST NEVER SHIP
 * This build environment blocks the `uv_interface_addresses` syscall, so
 * `os.networkInterfaces()` throws ERR_SYSTEM_ERROR (errno 13). Next.js calls it
 * unconditionally in `next start` to resolve its bind address, so the production
 * server cannot boot here at all.
 *
 * This shim returns a single synthetic loopback interface so `next start` can
 * resolve a hostname and the E2E suite can run. That is the ONLY thing it does.
 *
 * IT IS A SANDBOX WORKAROUND, NOT APPLICATION CODE:
 *   - It is loaded via NODE_OPTIONS only by playwright.config.ts's webServer.
 *   - It is NOT referenced by `npm run dev`, `npm start` or `npm run build`.
 *   - On a normal host, `os.networkInterfaces()` works and the shim is never
 *     loaded. It does not patch anything else, does not alter responses, and
 *     cannot affect a real deployment.
 *
 * If you ever find yourself needing this outside CI, the correct fix is to fix
 * the sandbox, not to widen this shim.
 */

const os = require("node:os");

if (process.env.VEENCART_ALLOW_NETWORK_SHIM !== "1") {
  // Opt-in guard: the shim stays inert unless the E2E runner sets the flag, so
  // an accidental NODE_OPTIONS copy-paste cannot silently activate it.
  return;
}

let broken = false;
try {
  os.networkInterfaces();
} catch {
  broken = true;
}

if (broken) {
  os.networkInterfaces = () => ({
    lo: [
      {
        address: "127.0.0.1",
        netmask: "255.0.0.0",
        family: "IPv4",
        mac: "00:00:00:00:00:00",
        internal: true,
        cidr: "127.0.0.1/8",
      },
    ],
  });
  process.env.HOSTNAME = process.env.HOSTNAME || "127.0.0.1";
}