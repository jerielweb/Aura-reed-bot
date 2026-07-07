import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["report", "bug", "sugerencia", "reportar", "sugerir"],
  category: "system",
  description:
    "Envía un reporte de bug o sugerencia a los desarrolladores del bot.",
  async execute(
    sock,
    m,
    args,
    { prefix, owners, groupMetadata, jidRemitente },
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
    const pushName = m.pushName || "Usuario";

    // Formatear mensaje para los propietarios
    let textForOwners = `╭〔 📢 ${fytBold("NUEVO REPORTE")} 〕━⬣\n\n`;
    textForOwners += `┃ 👤 ${fytBold("Usuario ›")} @${senderNumber}\n`;
    textForOwners += `┃ ☎️ ${fytBold("Numero ›")} +${jidRemitente.split("@")[0]}\n`;
    textForOwners += `┃ 📍 ${fytBold("Origen ›")} ${origen}\n`;
    textForOwners += `┃ 🕒 ${fytBold("Fecha ›")} ${new Date().toLocaleString("es-CR")}\n\n`;
    textForOwners += `┣━━━━━━━━━━━━⬣\n\n`;
    textForOwners += `┃ 📝 ${fytBold("Mensaje:")}\n`;
    textForOwners += `┃ > ${reportText}\n\n`;
    textForOwners += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

    let sentCount = 0;
    const targetOwners = Array.isArray(owners) ? owners : [];

    for (const ownerJid of targetOwners) {
      try {
        await sock.sendMessage(ownerJid, {
          text: textForOwners,
          mentions: [jidRemitente],
        });
        sentCount++;
      } catch (err) {
        console.error(
          `[Report Command] Error al enviar reporte al dueño (${ownerJid}):`,
          err,
        );
      }
    }

    if (sentCount > 0) {
      await sock.sendMessage(remoteJid, { react: { text: "✅", key: m.key } });
      await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ✅ ${fytBold("REPORTE ENVIADO")} 〕━⬣\n\n┃ > Tu reporte ha sido enviado con exito\n┃ > a los desarrolladores del bot.\n┃ > ¡Gracias por tu colaboracion!\n\n╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`,
        },
        { quoted: m },
      );
    } else {
      await sock.sendMessage(remoteJid, { react: { text: "❌", key: m.key } });
      await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("ERROR DE ENVIO")} 〕━⬣\n\n┃ > No se pudo enviar el reporte a los\n┃ > propietarios. Intentalo mas tarde.\n\n╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`,
        },
        { quoted: m },
      );
    }
  },
};
