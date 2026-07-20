import { fytBold } from "../../models/TextStyle.js";
import axios from "axios";

export default {
  name: ["md", "mf", "mediafire"],
  category: "downloads",
  description: "Descarga archivos de Mediafire",

  execute: async (socket, message, args) => {
    const link = args.join(" ").trim();
    const remoteJid = message.key.remoteJid;

    if (!link) {
      let errorText = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      errorText += `┃ ❌ ${fytBold("FALTA ENLACE")}\n`;
      errorText += `╰━━━━━━━━━━━━⬣\n\n`;
      errorText += `┃ > Por favor, proporciona un\n`;
      errorText += `┃ > enlace de Mediafire\n\n`;
      errorText += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return socket.sendMessage(remoteJid, { text: errorText }, { quoted: message });
    }

    if (!link.includes("mediafire.com")) {
      let errorText = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      errorText += `┃ ❌ ${fytBold("ENLACE INVÁLIDO")}\n`;
      errorText += `╰━━━━━━━━━━━━⬣\n\n`;
      errorText += `┃ > Por favor, proporciona un\n`;
      errorText += `┃ > enlace de Mediafire válido\n\n`;
      errorText += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return socket.sendMessage(remoteJid, { text: errorText }, { quoted: message });
    }

    // ⏳ Reacción de espera
    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      const apiKey = global.Apis?.apiAiya?.apikey || "oboe";
      const apiUrl = `https://api.alyacore.xyz/dl/mediafire?url=${encodeURIComponent(link)}&key=${apiKey}`;

      const { data: res } = await axios.get(apiUrl);

      if (!res || !res.status || !res.result) {
        await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
        return socket.sendMessage(remoteJid, { text: "❌ No se pudo obtener la información del archivo." }, { quoted: message });
      }

      const { filename, filetype, filesize, uploaded, download } = res.result;

      // Plantilla unificada como Caption
      let caption = `╭〔 📦 ${fytBold("MEDIAFIRE DOWNLOADER")} 〕━⬣\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(filename)}\n\n`;
      caption += `┃ > ${fytBold("Tamaño:")} › ${filesize}\n`;
      caption += `┃ > ${fytBold("Tipo:")} › ${filetype}\n`;
      caption += `┃ > ${fytBold("Subido:")} › ${uploaded}\n`;
      caption += `┃ > ${fytBold("Link:")} › ${link}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ > El archivo se esta\n`;
      caption += `┃ > enviando, espera un momento...\n\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      // Detección de extensión / Mimetype
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      let mimetype = "application/octet-stream";
      if (ext === "apk") mimetype = "application/vnd.android.package-archive";
      else if (ext === "zip") mimetype = "application/zip";
      else if (ext === "rar") mimetype = "application/x-rar-compressed";
      else if (ext === "pdf") mimetype = "application/pdf";

      // Envío único del documento con la plantilla en la propiedad `caption`
      await socket.sendMessage(
        remoteJid,
        {
          document: { url: download },
          fileName: filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`,
          mimetype,
          caption,
        },
        { quoted: message }
      );

      // ✅ Reacción de éxito
      return await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });

    } catch (error) {
      console.error("[MEDIAFIRE CMD ERROR]:", error);
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
      return socket.sendMessage(remoteJid, { text: `❌ Ocurrió un error al procesar el archivo: ${error.message}` }, { quoted: message });
    }
  },
};
