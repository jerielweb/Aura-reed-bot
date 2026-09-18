import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fytBold } from "../../models/TextStyle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../");

const getDirSize = async (dir) => {
  let size = 0;
  try {
    const files = await fs.promises.readdir(dir, { withFileTypes: true });
    const sizes = await Promise.all(
      files.map(async (file) => {
        const fp = path.join(dir, file.name);
        if (file.isDirectory()) {
          return await getDirSize(fp);
        } else {
          const stat = await fs.promises.stat(fp).catch(() => ({ size: 0 }));
          return stat.size;
        }
      }),
    );
    size = sizes.reduce((acc, val) => acc + val, 0);
  } catch (e) {}
  return size;
};

const formatSize = (bytes) => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
  return bytes + " B";
};

export default {
  name: ["locate", "scanner", "dirsize"],
  category: "system",
  description: "Analiza el peso de las carpetas y archivos del bot.",

  execute: async (sock, m, args, isOwner) => {
    try {
      const chatId = m?.key?.remoteJid;

      if (!isOwner) {
        return await sock.sendMessage(
          chatId,
          {
            text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ 🚫 ${fytBold("ACCESO DENEGADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Solo el owner puede usar este comando.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
          },
          { quoted: m },
        );
      }

      await sock.sendMessage(chatId, {
        text: `> 🔍 Escaneando sistema de archivos, espera un momento...`,
        react: { text: "⏳", key: m.key },
      });

      const items = await fs.promises.readdir(rootDir, { withFileTypes: true });
      const sizes = [];
      let totalSize = 0;

      for (const item of items) {
        const itemPath = path.join(rootDir, item.name);
        let size = 0;
        if (item.isDirectory()) {
          size = await getDirSize(itemPath);
        } else {
          const stat = await fs.promises
            .stat(itemPath)
            .catch(() => ({ size: 0 }));
          size = stat.size;
        }
        totalSize += size;
        sizes.push({ name: item.name, isDir: item.isDirectory(), size });
      }

      sizes.sort((a, b) => b.size - a.size);

      let caption = `╭〔 📁 ${fytBold("STORAGE LOCATE")} 〕⬣\n`;
      caption += `┃ 📊 ${fytBold("Peso Total:")} ${formatSize(totalSize)}\n`;
      caption += `╰━━━━━━━━━━━━⬣\n\n`;

      const topItems = sizes.slice(0, 15);
      for (let i = 0; i < topItems.length; i++) {
        const { name, isDir, size } = topItems[i];
        const icon = isDir ? "📁" : "📄";
        caption += `┃ ${i + 1}. ${icon} ${name}\n┃ > ${formatSize(size)}\n`;
      }

      caption += `\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

      await sock.sendMessage(chatId, { text: caption }, { quoted: m });
      await sock.sendMessage(chatId, { react: { text: "✅", key: m.key } });
    } catch (error) {
      console.error("[locate]", error);
      if (sock && m) {
        await sock
          .sendMessage(
            m?.key?.remoteJid,
            {
              text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR AL ESCANEAR")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error?.message || error}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
            },
            { quoted: m },
          )
          .catch(() => {});
      }
    }
  },
};
