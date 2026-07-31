import chalk from "chalk";
import fs from "fs";
import { fytBold } from "../models/TextStyle.js";

// 1. EVENTOS DE PARTICIPANTES (Add, Remove, Promote, Demote)
export async function handleGroupUpdate(
  sock,
  { id, participants, action },
  getDB,
) {
  const db = await getDB();
  const groupData = db.groups[id];

  // Verificar si el bot actual es el primario asignado a este grupo
  const botId = sock.user?.id
    ? sock.user.id.split("@")[0].split(":")[0] + "@s.whatsapp.net"
    : null;
  void sock.updateMetadata(id).catch((err) => {});
  const groupPrimaryBot = groupData?.primaryBot;
  if (groupPrimaryBot && botId && groupPrimaryBot !== botId) {
    console.log(
      `[GROUP-EVENT] Ignorado por no ser bot primario. Bot actual: ${botId} | Primario: ${groupPrimaryBot}`,
    );
    return;
  }

  console.log(
    chalk.gray(
      `[GROUP-EVENT] Acción: ${action} | Grupo: ${id} | Participants: ${participants.length}`,
    ),
  );

  // 1. EVENTO: BIENVENIDA (add)
  if (action === "add") {
    if (!groupData?.welcome) {
      console.log(
        chalk.gray(`[GROUP-EVENT] Bienvenida desactivada para este grupo.`),
      );
      return;
    }

    console.log(
      chalk.gray(
        `[GROUP-EVENT] Procesando bienvenida para ${participants.length} integrantes...`,
      ),
    );
    try {
      const metadata = await sock.groupMetadata(id);
      const groupName = metadata.subject;

      for (let participant of participants) {
        if (!participant) continue;

        const jid =
          typeof participant === "string"
            ? participant
            : participant.id || participant.jid;
        if (!jid || typeof jid !== "string") continue;

        const user = jid.split("@")[0];

        let text = `╭〔 👋 𝐁𝐈𝐄𝐍𝐕𝐄𝐍𝐈𝐃𝐎/𝐀 〕⬣\n`;
        text += `┃ ✨ 𝐀 𝐔𝐍 𝐍𝐔𝐄𝐕𝐎 𝐈𝐍𝐓𝐄𝐆𝐑𝐀𝐍𝐓𝐄\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ 👋 𝐇𝐨𝐥𝐚 @${user}\n`;
        text += `┃ ✨ 𝐁𝐢𝐞𝐧𝐯𝐞𝐧𝐢𝐝𝐨/𝐚 𝐚:\n`;
        text += `┃ 🏰 *${groupName}*\n\n`;
        text += `┃ 📜 𝐍𝐨 𝐨𝐥𝐯𝐢𝐝𝐞𝐬 𝐥𝐞𝐞𝐫 𝐥𝐚𝐬 𝐫𝐞𝐠𝐥𝐚𝐬\n`;
        text += `┃ 𝐲 𝐝𝐢𝐬𝐟𝐫𝐮𝐭𝐚𝐫 𝐭𝐮 𝐞𝐬𝐭𝐚𝐧𝐜𝐢𝐚.\n\n`;
        text += `╰━━〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕━━⬣`;

        let ppUrl;
        try {
          ppUrl = await sock.profilePictureUrl(jid, "image");
        } catch {
          ppUrl =
            "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
        }

        await sock.sendMessage(id, {
          image: { url: ppUrl },
          caption: text,
          mentions: [jid],
        });
      }
    } catch (e) {
      console.error(chalk.red("[GROUP UPDATE] Error en bienvenida:"), e);
    }
  }

  // 2. EVENTO: DESPEDIDA (remove)
  else if (action === "remove") {
    if (!groupData?.bye) {
      console.log(
        chalk.gray(`[GROUP-EVENT] Despedida desactivada para este grupo.`),
      );
      return;
    }

    console.log(
      chalk.gray(
        `[GROUP-EVENT] Procesando despedida para ${participants.length} integrantes...`,
      ),
    );

    try {
      const metadata = await sock.groupMetadata(id);
      const groupName = metadata.subject;

      for (let participant of participants) {
        if (!participant) continue;

        const jid =
          typeof participant === "string"
            ? participant
            : participant.id || participant.jid;
        if (!jid || typeof jid !== "string") continue;

        const user = jid.split("@")[0];

        let text = `╭〔 😔 ${fytBold("SE NOS FUE UN GRANDE")} 〕⬣\n`;
        text += `┃ ✨ ${fytBold("HASTA PRONTO")}\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ 👋 ${fytBold(`Adios @${user}`)}\n`;
        text += `┃ > ${fytBold("Es una pena que te vayas de:")}\n`;
        text += `┃ > *${groupName}*\n\n`;
        text += `┃ > ${fytBold("Nunca te olvidaremos")}\n\n`;
        text += `╰━━〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕━━⬣`;

        let ppUrl;
        try {
          ppUrl = await sock.profilePictureUrl(jid, "image");
        } catch {
          ppUrl =
            "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
        }

        await sock.sendMessage(id, {
          image: { url: ppUrl },
          caption: text,
          mentions: [jid],
        });
      }
    } catch (e) {
      console.error(chalk.red("[GROUP UPDATE] Error en despedida:"), e);
    }
  }

  // 3. EVENTO: ASCENSO A ADMIN (promote)
  else if (action === "promote") {
    if (!db.groups[id]?.alerts) {
      console.log(chalk.gray(`[GROUP-EVENT] Las alertas están desactivadas.`));
      return;
    }

    try {
      for (let participant of participants) {
        if (!participant) continue;

        const jid =
          typeof participant === "string"
            ? participant
            : participant.id || participant.jid;
        if (!jid || typeof jid !== "string") continue;

        const user = jid.split("@")[0].split(":")[0];

        let text = `╭〔 🎉 𝐍𝐔𝐄𝐕𝐎 𝐀𝐃𝐌𝐈𝐍 〕⬣\n\n`;
        text += `┃ 👑 ¡Felicidades @${user}!\n`;
        text += `┃ > Has sido ascendido a Administrador.\n`;
        text += `┃ > Más te vale no abusar de tu poder.\n\n`;
        text += `╰━━〔 ⚡ ${fytBold("AURA NEWS")} 〕━━⬣`;

        await sock.sendMessage(id, { text, mentions: [jid] });
      }
    } catch (e) {
      console.error(chalk.red("[GROUP UPDATE] Error en promote:"), e);
    }
  }

  // 4. EVENTO: DEGRADACIÓN DE ADMIN (demote)
  else if (action === "demote") {
    if (!db.groups[id]?.alerts) {
      console.log(chalk.gray(`[GROUP-EVENT] Las alertas están desactivadas.`));
      return;
    }

    try {
      for (let participant of participants) {
        if (!participant) continue;

        const jid =
          typeof participant === "string"
            ? participant
            : participant.id || participant.jid;
        if (!jid || typeof jid !== "string") continue;

        const user = jid.split("@")[0].split(":")[0];

        let text = `╭〔 ⚠️ 𝐀𝐃𝐌𝐈𝐍 𝐃𝐄𝐆𝐑𝐀𝐃𝐀𝐃𝐎 〕⬣\n\n`;
        text += `┃ 📉 @${user} ya no es Administrador.\n`;
        text += `┃ > Se le han retirado sus privilegios.\n\n`;
        text += `╰━━〔 ⚡ ${fytBold("AURA NEWS")} 〕━━⬣`;

        await sock.sendMessage(id, { text, mentions: [jid] });
      }
    } catch (e) {
      console.error(chalk.red("[GROUP UPDATE] Error en demote:"), e);
    }
  }
}

// 2. NUEVO EVENTO: CAMBIOS DE CONFIGURACIÓN Y METADATOS DEL GRUPO
export async function handleGroupMetadataUpdate(sock, updates, getDB) {
  const db = await getDB();

  for (const update of updates) {
    const { id, subject, desc, announce, restrict, ephemeral, revive } = update;
    const groupData = db.groups[id];

    // Verificar bot primario
    const botId = sock.user?.id
      ? sock.user.id.split("@")[0].split(":")[0] + "@s.whatsapp.net"
      : null;
    const groupPrimaryBot = groupData?.primaryBot;
    if (groupPrimaryBot && botId && groupPrimaryBot !== botId) continue;

    // Verificar si el grupo tiene activadas las alertas
    if (!groupData?.alerts) continue;

    try {
      // 1. Cambio de Nombre / Nombre del grupo
      if (subject) {
        let text = `╭〔 ✏️ 𝐍𝐎𝐌𝐁𝐑𝐄 𝐀𝐂𝐓𝐔𝐀𝐋𝐈𝐙𝐀𝐃𝐎 〕⬣\n\n`;
        text += `┃ 📝 El nuevo nombre del grupo es:\n`;
        text += `┃ > *${subject}*\n\n`;
        text += `╰━━〔 ⚡ ${fytBold("AURA NEWS")} 〕━━⬣`;
        await sock.sendMessage(id, { text });
      }

      // 2. Cambio de Descripción (Detecta la nueva versión completa)
      if (desc !== undefined) {
        let nuevaDesc = desc;
        if (!nuevaDesc) {
          try {
            const meta = await sock.groupMetadata(id);
            nuevaDesc = meta.desc || "_Sin descripción_";
          } catch {
            nuevaDesc = "_Descripción actualizada_";
          }
        }

        let text = `╭〔 📜 𝐃𝐄𝐒𝐂𝐑𝐈𝐏𝐂𝐈𝐎́𝐍 𝐂𝐀𝐌𝐁𝐈𝐀𝐃𝐀 〕⬣\n\n`;
        text += `┃ 📋 Nueva descripción:\n`;
        text += `┃ ${nuevaDesc}\n\n`;
        text += `╰━━〔 ⚡ ${fytBold("AURA NEWS")} 〕━━⬣`;
        await sock.sendMessage(id, { text });
      }

      // 3. Abrir o Cerrar Grupo (announce)
      if (announce !== undefined) {
        const estado = announce
          ? "🔒 *CERRADO*\n┃ > (Solo administradores pueden enviar mensajes)"
          : "🔓 *ABIERTO*\n┃ > (Todos los miembros pueden enviar mensajes)";
        let text = `╭〔 ⚙️ 𝐀𝐉𝐔𝐒𝐓𝐄 𝐃𝐄 𝐂𝐇𝐀𝐓 〕⬣\n\n`;
        text += `┃ El grupo ahora está:\n`;
        text += `┃ > ${estado}\n\n`;
        text += `╰━━〔 ⚡ ${fytBold("AURA NEWS")} 〕━━⬣`;
        await sock.sendMessage(id, { text });
      }

      // 4. Editar información del grupo (restrict)
      if (restrict !== undefined) {
        const permiso = restrict ? "🔒 Solo Administradores" : "🔓 Todos los miembros";
        let text = `╭〔 ⚙️ 𝐄𝐃𝐈𝐂𝐈𝐎́𝐍 𝐃𝐄 𝐆𝐑𝐔𝐏𝐎 〕⬣\n\n`;
        text += `┃ ¿Quién puede editar la información del grupo?: \n`;
        text += `┃ > *${permiso}*\n\n`;
        text += `╰━━〔 ⚡ ${fytBold("AURA NEWS")} 〕━━⬣`;
        await sock.sendMessage(id, { text });
      }

      // 5. Mensajes Temporales (ephemeral)
      if (ephemeral !== undefined) {
        const duracion = ephemeral ? `${ephemeral / 86400} días` : "Desactivados";
        let text = `╭〔 ⏳ 𝐌𝐄𝐍𝐒𝐀𝐉𝐄𝐒 𝐓𝐄𝐌𝐏𝐎𝐑𝐀𝐋𝐄𝐒 〕⬣\n\n`;
        text += `┃ Los mensajes temporales ahora están en:\n`;
        text += `┃ > *${duracion}*\n\n`;
        text += `╰━━〔 ⚡ ${fytBold("AURA NEWS")} 〕━━⬣`;
        await sock.sendMessage(id, { text });
      }

      // 6. Restablecer / Revocar enlace del grupo
      if (revive) {
        let text = `╭〔 🔗 𝐄𝐍𝐋𝐀𝐂𝐄 𝐑𝐄𝐒𝐓𝐀𝐁𝐋𝐄𝐂𝐈𝐃𝐎 〕⬣\n\n`;
        text += `┃ ⚠️ Un administrador restableció el enlace del grupo.\n`;
        text += `┃ > El enlace anterior dejó de funcionar.\n\n`;
        text += `╰━━〔 ⚡ ${fytBold("AURA NEWS")} 〕━━⬣`;
        await sock.sendMessage(id, { text });
      }
    } catch (e) {
      console.error(chalk.red("[GROUP METADATA UPDATE] Error:"), e);
    }
  }
}
