import { fytBold } from "../../models/TextStyle.js";
import { getMainSocket } from "../../models/subbotManager.js";

const REPORT_GROUP_JID = "120363410372126705@g.us";

export default {
  name: ["report", "bug", "sugerencia", "reportar", "sugerir"],
  category: "system",
  description:
    "Envía un reporte de bug o sugerencia al grupo de soporte usando el bot principal.",
  async execute(
    sock,
    m,
    args,
    { prefix, groupMetadata, jidRemitente },
  ) {
    const remoteJid = m.key.remoteJid;
    const reportText = args.join(" ").trim();

    if (!reportText) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA TEXTO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, escribe tu reporte.\n┃ > Ejemplo: *${prefix}report El comando sticker no funciona con videos.*\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: m },
      );
    }

    await sock.sendMessage(remoteJid, { react: { text: "📨", key: m.key } });

    const isGroup = remoteJid.endsWith("@g.us");
    const origen = isGroup
      ? `Grupo: ${groupMetadata?.subject || "Desconocido"}`
      : "Chat Privado";
    const senderNumber = jidRemitente.split("@")[0];

    // Formatear mensaje para el grupo de soporte
    let textForReport = `╭〔 📢 ${fytBold("NUEVO REPORTE")} 〕━⬣\n\n`;
    textForReport += `┃ 👤 ${fytBold("Usuario ›")} @${senderNumber}\n`;
    textForReport += `┃ ☎️ ${fytBold("Numero ›")} +${senderNumber}\n`;
    textForReport += `┃ 📍 ${fytBold("Origen ›")} ${origen}\n`;
    textForReport += `┃ 🕒 ${fytBold("Fecha ›")} ${new Date().toLocaleString("es-CR")}\n\n`;
    textForReport += `┣━━━━━━━━━━━━⬣\n\n`;
    textForReport += `┃ 📝 ${fytBold("Mensaje:")}\n`;
    textForReport += `┃ > ${reportText}\n\n`;
    textForReport += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

    try {
      // Usa el socket del Bot Principal si está disponible, de lo contrario usa el socket actual
      const mainSock = (typeof getMainSocket === "function" ? getMainSocket() : null) || global.mainSocket || sock;

      await mainSock.sendMessage(REPORT_GROUP_JID, {
        text: textForReport,
        mentions: [jidRemitente],
      });

      await sock.sendMessage(remoteJid, { react: { text: "✅", key: m.key } });
      await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ✅ ${fytBold("REPORTE ENVIADO")} 〕━⬣\n\n┃ > Tu reporte ha sido enviado con exito\n┃ > al grupo de soporte del bot.\n┃ > ¡Gracias por tu colaboracion!\n\n╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`,
        },
        { quoted: m },
      );
    } catch (err) {
      console.error("[Report Command] Error al enviar reporte al grupo desde el bot principal:", err);
      await sock.sendMessage(remoteJid, { react: { text: "❌", key: m.key } });
      await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("ERROR DE ENVIO")} 〕━⬣\n\n┃ > No se pudo enviar el reporte en este momento.\n┃ > Intentalo mas tarde.\n\n╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`,
        },
        { quoted: m },
      );
    }
  },
};
