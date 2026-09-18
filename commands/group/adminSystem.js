import { fytBold } from "../../models/TextStyle.js";

const status = (value) => (value ? "✅ Activado" : "❌ Desactivado");
const onlyAdmin = (value) => (value ? "🔒 Solo Admins" : "🔓 Todos");
const onlyAdminMenbers = (value) => (value ? "🔓 Todos" : "🔒 Solo Admins");

const formatDuration = (seconds) => {
  if (!seconds) return "Desactivados";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || !parts.length) parts.push(`${minutes}min`);

  return parts.join(" ");
};

export default {
  name: ["adminsystem", "adminsys", "configgrupo", "groupconfig"],
  category: "group",
  description: "Muestra las configuraciones actuales del grupo.",
  adminOnly: true,
  execute: async (socket, message, args, { db, groupMetadata }) => {
    const remoteJid = message.key.remoteJid;

    if (!remoteJid?.endsWith("@g.us")) {
      const text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("ACCIÓN INCOMPATIBLE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo funciona en grupos.\n\n╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;
      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const metadata = groupMetadata || {};
    const participants = Array.isArray(metadata.participants)
      ? metadata.participants
      : [];
    const admins = participants.filter((participant) => participant.admin);
    const ephemeralDuration = formatDuration(metadata.ephemeralDuration);
    const groupSettings = db?.groups?.[remoteJid] || {};

    let text = `╭〔 ⚙️ ${fytBold("ADMIN SYSTEM")} 〕⬣\n`;
    text += `┃ 🏷️ ${fytBold(metadata.subject || "Grupo")}\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┣━━〔 🛡️ ${fytBold("CONFIGURACIÓN")} 〕━⬣\n\n`;
    text += `┃ 🔒 ${fytBold("Edición del grupo")} › ${onlyAdmin(metadata.restrict)}\n`;
    text += `┃ 📢 ${fytBold("Grupo Cerrado")} › ${status(metadata.announce)}\n`;
    text += `┃ ✅ ${fytBold("Aprobación para unirse")} › ${status(metadata.joinApprovalMode)}\n`;
    text += `┃ ➕ ${fytBold("Añadir miembros")} › ${onlyAdminMenbers(metadata.memberAddMode)}\n`;
    text += `┃ ⏳ ${fytBold("Mensajes temporales")} › ${ephemeralDuration}\n\n`;
    text += `┣━━〔 🛡️ ${fytBold("FILTROS")} 〕━⬣\n\n`;
    text += `┃ 🔗 ${fytBold("Antilink")} › ${status(groupSettings.antilink)}\n`;
    text += `┃ 🟢 ${fytBold("Antiestado")} › ${status(groupSettings.antiStatus)}\n`;
    text += `┃ 🗑️ ${fytBold("Antitóxico")} › ${status(groupSettings.antitoxic)}\n`;
    text += `┃ 📞 ${fytBold("Antillamadas")} › ${status(groupSettings.antiCalls)}\n\n`;
    text += `┣━━〔 🌐 ${fytBold("TIPO DE GRUPO")} 〕━⬣\n\n`;
    text += `┃ 👥 ${fytBold("Miembros")} › ${participants.length}\n`;
    text += `┃ 🛡️ ${fytBold("Administradores")} › ${admins.length}\n`;
    text += `┃ 🏘️ ${fytBold("Comunidad")} › ${status(metadata.isCommunity)}\n`;
    text += `┃ 📣 ${fytBold("Anuncio de comunidad")} › ${status(metadata.isCommunityAnnounce)}\n\n`;
    text += `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;

    return socket.sendMessage(remoteJid, { text }, { quoted: message });
  },
};
