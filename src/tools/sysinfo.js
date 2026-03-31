/**
 * tools/sysinfo.js
 *
 * Returns system information using Node.js built-in `os` module.
 * No network calls — runs entirely locally.
 */

import os from "os";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

export const sysinfoTool = {
  name: "system_info",
  description:
    "Returns information about the local system: OS, CPU, memory, uptime, and hostname.",
  parameters: {
    type:       "object",
    properties: {},
    required:   [],
  },

  execute() {
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();
    const usedMem  = totalMem - freeMem;
    const memPct   = ((usedMem / totalMem) * 100).toFixed(1);

    const cpus      = os.cpus();
    const cpuModel  = cpus[0]?.model?.trim() ?? "Unknown";
    const cpuCount  = cpus.length;

    const loadAvg = os.loadavg().map(n => n.toFixed(2)).join(", ");

    return (
      `System Information:\n` +
      `• OS:       ${os.type()} ${os.release()} (${os.arch()})\n` +
      `• Host:     ${os.hostname()}\n` +
      `• CPU:      ${cpuModel} × ${cpuCount} cores\n` +
      `• Load avg: ${loadAvg} (1/5/15 min)\n` +
      `• Memory:   ${formatBytes(usedMem)} used / ${formatBytes(totalMem)} total (${memPct}%)\n` +
      `• Uptime:   ${formatUptime(os.uptime())}`
    );
  },
};
