import os from "os";
import process from "process";
import fs from "fs";
import { fytBold } from "./../../models/TextStyle.js";

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === Infinity) return "0.00";
  return (bytes / 1024 / 1024 / 1024).toFixed(2);
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

function getMemoryInfo() {
  try {
    // Intentar Cgroups v2 (Sistemas modernos de contenedores/Pterodactyl)
    if (
      fs.existsSync("/sys/fs/cgroup/memory.max") &&
      fs.existsSync("/sys/fs/cgroup/memory.current")
    ) {
      let total = fs.readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
      let used = fs
        .readFileSync("/sys/fs/cgroup/memory.current", "utf8")
        .trim();

      if (total !== "max" && !isNaN(Number(total)) && Number(total) > 0) {
        return { total: Number(total), used: Number(used) };
      }
    }

    // Intentar Cgroups v1 (Sistemas clásicos)
    if (fs.existsSync("/sys/fs/cgroup/memory/memory.limit_in_bytes")) {
      const total = fs
        .readFileSync("/sys/fs/cgroup/memory/memory.limit_in_bytes", "utf8")
        .trim();
      const used = fs
        .readFileSync("/sys/fs/cgroup/memory/memory.usage_in_bytes", "utf8")
        .trim();

      if (
        !isNaN(Number(total)) &&
        Number(total) < 9223372036854771712 &&
        Number(total) > 0
      ) {
        return { total: Number(total), used: Number(used) };
      }
    }
  } catch (e) {
    // Silenciar errores de lectura de archivos virtuales del sistema
  }

  // Fallback: Si el contenedor no expone sus límites, usamos la memoria del bot actual como referencia limpia
  const used = process.memoryUsage().rss;
  const total = os.totalmem(); // Mantiene el total si no hay restricción visible
  return { total, used };
}

export default {
  name: ["system", "sys", "info"],
  category: "system",
  description: "Muestra componentes reales del sistema asignado.",
  ownerOnly: true,

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;

    // ── CPU ──
    const cpus = os.cpus();
    const cpuModel =
      cpus && cpus[0]?.model ? cpus[0].model.trim() : "Desconocido";

    let cpuCores = 1;
    try {
      cpuCores =
        typeof os.availableParallelism === "function"
          ? os.availableParallelism()
          : cpus
            ? cpus.length
            : 1;
    } catch {
      cpuCores = cpus ? cpus.length : 1;
    }

    const platform = `${os.platform()} (${os.arch()})`;

    // ── MEMORIA RAM (SERVIDOR REAL) ──
    const memory = getMemoryInfo();
    const ramTotal = memory.total;
    const ramUsed = memory.used;
    const ramFree = ramTotal - ramUsed;
    const ramBot = process.memoryUsage().heapUsed; // Mantiene el heapUsed nativo de tu bot anterior

    const ramPercent =
      ramTotal > 0 ? ((ramUsed / ramTotal) * 100).toFixed(1) : "0.0";

    // ── UPTIME ──
    const botUp = process.uptime();
    const sysUp = os.uptime();

    // ── ENTORNO ──
    const nodeVersion = process.version;
    const pid = process.pid;

    // ── CONSTRUCCIÓN DEL DISEÑO ──
    let text = `╭━〔 🖥️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐑𝐄𝐄𝐃 〕━⬣\n\n`;

    // Sección CPU
    text += `┣━━━━━ ${fytBold("CPU")} ━━━━━⬣\n`;
    text += `┃ > ${fytBold("Modelo:")} ${cpuModel}\n`;
    text += `┃ > ${fytBold("Núcleos:")} ${cpuCores}\n`;
    text += `┃ > ${fytBold("Plataforma:")} ${platform}\n\n`;

    // Sección RAM (Corregida)
    text += `┣━━━━━ ${fytBold("RAM")} ━━━━⬣\n`;
    text += `┃ > ${fytBold("Total:")} ${formatBytes(ramTotal)} GB\n`;
    text += `┃ > ${fytBold("Usada:")} ${formatBytes(ramUsed)} GB (${ramPercent}%)\n`;
    text += `┃ > ${fytBold("Libre:")} ${formatBytes(ramFree)} GB\n`;
    text += `┃ > ${fytBold("Bot usa:")} ${formatBytes(ramBot)} GB\n\n`;

    // Sección UPTIME
    text += `┣━━━━ ${fytBold("UPTIME")} ━━━━⬣\n`;
    text += `┃ > ${fytBold("Bot activo:")} ${formatTime(botUp)}\n`;
    text += `┃ > ${fytBold("Servidor:")} ${formatTime(sysUp)}\n\n`;

    // Sección ENTORNO
    text += `┣━━━ ${fytBold("ENTORNO")} ━━━━⬣\n`;
    text += `┃ > ${fytBold("Node.js:")} ${nodeVersion}\n`;
    text += `┃ > ${fytBold("PID:")} ${pid}\n\n`;

    text += `╰━━━━━━━━━━━━⬣`;

    await socket.sendMessage(remoteJid, { text }, { quoted: message });
  },
};
