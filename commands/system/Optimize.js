import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { fytBold } from "../../models/TextStyle.js";
import { getDownloadCacheDir } from "../../controllers/downloadUtils.js";

const execAsync = promisify(exec);

export default {
  name: ["optimize", "optimizervps"],
  category: "owner",
  description: "Mata procesos zombies y limpia el contenedor.",
  ownerOnly: true,

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;

    await socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

    let killedProcesses = false;
    let clearedFiles = 0;

    try {
      await execAsync("pkill -f ffmpeg || true");
      await execAsync("pkill -f wget || true");
      killedProcesses = true;
    } catch (e) {}

    try {
      const tmpDir = getDownloadCacheDir();
      const files = await fs.readdir(tmpDir);
      for (const file of files) {
        await fs.unlink(path.join(tmpDir, file)).catch(() => {});
        clearedFiles++;
      }
    } catch (e) {}

    try {
      await execAsync("npm cache clean --force || true");
    } catch (e) {}

    let text = `╭〔 🚀 ${fytBold("AURA REED OPTIMIZER")} 〕⬣\n\n`;
    text += `┃ ✅ ${fytBold("PROCESOS FANTASMAS")}\n`;
    
    if (killedProcesses) {
      text += `┃ > Subprocesos trabados aniquilados.\n\n`;
    } else {
      text += `┃ > No había subprocesos colgados.\n\n`;
    }

    text += `┃ ✅ ${fytBold("LIMPIEZA PROFUNDA")}\n`;
    text += `┃ > ${clearedFiles} archivos temporales borrados.\n`;
    text += `┃ > Caché de NPM purgada.\n\n`;
    text += `┃ ⚠️ ${fytBold("RESTRICCIÓN DE KERNEL")}\n`;
    text += `┃ > Al ejecutarse en Pterodactyl (Docker),\n`;
    text += `┃ > el sistema aísla la terminal.\n`;
    text += `┃ > El acceso Root al Kernel del host\n`;
    text += `┃ > está bloqueado por seguridad.\n\n`;
    text += `╰━━〔 ⚡ ${fytBold("SYSTEM")} 〕━━⬣`;

    await socket.sendMessage(remoteJid, { text }, { quoted: message });
    await socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } });
  },
};
