import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fytBold } from "../../models/TextStyle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDirs = [
  path.join(__dirname, "../../tmp"),
  path.join(__dirname, "../../temp"),
  path.join(__dirname, "../../.npm"),
  path.join(__dirname, "../../.cache"),
];

export default {
  name: ["cleartmp", "limpiartmp", "deltmp", "cleartemp"],
  category: "system",
  description:
    "Limpia las carpetas temporales y de caché del bot para liberar memoria.",

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

      await sock.sendMessage(chatId, { react: { text: "🧹", key: m.key } });

      let deletedFiles = 0;
      let freedSpace = 0;

      for (const dir of targetDirs) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            try {
              const stat = fs.statSync(filePath);
              freedSpace += stat.size;

              if (stat.isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(filePath);
              }
              deletedFiles++;
            } catch (err) {
              console.log(`[cleartmp] Ignorado: ${filePath}`);
            }
          }
        }
      }

      if (deletedFiles === 0) {
        return await sock.sendMessage(
          chatId,
          {
            text: `╭〔 🧹 ${fytBold("AURA SYSTEM")} 〕⬣\n┃ ✅ ${fytBold("CARPETAS VACÍAS")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Las carpetas temporales ya están limpias.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
          },
          { quoted: m },
        );
      }

      const freedMB = (freedSpace / 1024 / 1024).toFixed(2);

      let caption = `╭〔 🧹 ${fytBold("AURA SYSTEM")} 〕⬣\n`;
      caption += `┃ ✅ ${fytBold("LIMPIEZA COMPLETADA")}\n`;
      caption += `╰━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ > ${fytBold("Archivos eliminados:")} ${deletedFiles}\n`;
      caption += `┃ > ${fytBold("Memoria liberada:")} ${freedMB} MB\n\n`;
      caption += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

      await sock.sendMessage(chatId, { text: caption }, { quoted: m });
    } catch (error) {
      console.error("[cleartmp]", error);
      if (sock && m) {
        await sock
          .sendMessage(
            m?.key?.remoteJid,
            {
              text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR AL LIMPIAR")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error?.message || error}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
            },
            { quoted: m },
          )
          .catch(() => {});
      }
    }
  },
};
