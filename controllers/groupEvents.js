import chalk from "chalk";
import { fytBold } from "../models/TextStyle.js";

export async function handleGroupUpdate(sock, { id, participants, action }, getDB) {
  if (!participants || participants.length === 0) return;

  const db = await getDB();
  const groupData = db.groups?.[id] || {};

  const botId = sock.user?.id ? `${sock.user.id.split(":")[0]}@s.whatsapp.net` : null;
  if (groupData.primaryBot && botId && groupData.primaryBot !== botId) return;

  const isAdd = action === "add";
  const isRemove = action === "remove";
  const isPromote = action === "promote";
  const isDemote = action === "demote";

  if (isAdd && !groupData.welcome) return;
  if (isRemove && !groupData.bye) return;
  if ((isPromote || isDemote) && !groupData.alerts) return;

  try {
    const metadata = await sock.groupMetadata(id).catch(() => null);
    if (!metadata) return;

    const groupName = metadata.subject;
    const groupDesc = metadata.desc?.toString() || "Sin descripción";
    const memberCount = metadata.participants.length;

    const cleanJids = participants.map(p => (typeof p === "string" ? p : p.id || p.jid)).filter(Boolean);
    if (cleanJids.length === 0) return;

    const tags = cleanJids.map(jid => `@${jid.split("@")[0].split(":")[0]}`).join(", ");

    let ppUrl = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
    if (isAdd || isRemove) {
      try {
        ppUrl = cleanJids.length === 1
          ? await sock.profilePictureUrl(cleanJids[0], "image")
          : await sock.profilePictureUrl(id, "image");
      } catch {}
    }

    let text = "";

    if (isAdd) {
      const defaultWelcome = `╭〔 👋 𝐁𝐈𝐄𝐍𝐕𝐄𝐍𝐈𝐃𝐎/𝐀 〕⬣\n┃ ✨ 𝐀 𝐔𝐍 𝐍𝐔𝐄𝐕𝐎 𝐈𝐍𝐓𝐄𝐆𝐑𝐀𝐍𝐓𝐄\n╰━━━━━━━━━━━━⬣\n\n┃ 👋 𝐇𝐨𝐥𝐚 @user\n┃ ✨ 𝐁𝐢𝐞𝐧𝐯𝐞𝐧𝐢𝐝𝐨/𝐚 𝐚:\n┃ 🏰 *@group*\n\n┃ 📜 𝐍𝐨 𝐨𝐥𝐯𝐢𝐝𝐞𝐬 𝐥𝐞𝐞𝐫 𝐥𝐚𝐬 𝐫𝐞𝐠𝐥𝐚𝐬\n┃ 𝐲 𝐝𝐢𝐬𝐟𝐫𝐮𝐭𝐚𝐫 𝐭𝐮 𝐞𝐬𝐭𝐚𝐧𝐜𝐢𝐚.\n\n╰━━〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕━━⬣`;
      const template = groupData.welcomeMessage || defaultWelcome;
      text = template
        .replace(/@user/g, tags)
        .replace(/@group/g, groupName)
        .replace(/@desc/g, groupDesc)
        .replace(/@count/g, memberCount);

      await sock.sendMessage(id, { image: { url: ppUrl }, caption: text, mentions: cleanJids });
    } 
    else if (isRemove) {
      const defaultBye = `╭〔 😔 ${fytBold("SE NOS FUE")} 〕⬣\n┃ ✨ ${fytBold("HASTA PRONTO")}\n╰━━━━━━━━━━━━⬣\n\n┃ 👋 ${fytBold("Adiós @user")}\n┃ > ${fytBold("Es una pena que te vayas de:")}\n┃ > *@group*\n\n┃ > ${fytBold("Nunca te olvidaremos")}\n\n╰━━〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕━━⬣`;
      const template = groupData.byeMessage || defaultBye;
      text = template
        .replace(/@user/g, tags)
        .replace(/@group/g, groupName)
        .replace(/@count/g, memberCount);

      await sock.sendMessage(id, { image: { url: ppUrl }, caption: text, mentions: cleanJids });
    } 
    else if (isPromote) {
      text = `╭〔 🎉 𝐍𝐔𝐄𝐕𝐎 𝐀𝐃𝐌𝐈𝐍 〕⬣\n\n┃ 👑 ¡Felicidades ${tags}!\n┃ > Has sido ascendido a Administrador.\n┃ > Más te vale no abusar de tu poder.\n\n╰━━〔 ⚡ ${fytBold("AURA NEWS")} 〕━━⬣`;
      await sock.sendMessage(id, { text, mentions: cleanJids });
    } 
    else if (isDemote) {
      text = `╭〔 ⚠️ 𝐀𝐃𝐌𝐈𝐍 𝐃𝐄𝐆𝐑𝐀𝐃𝐀𝐃𝐎 〕⬣\n\n┃ 📉 ${tags} ya no es Administrador.\n┃ > Se le han retirado sus privilegios.\n\n╰━━〔 ⚡ ${fytBold("AURA NEWS")} 〕━━⬣`;
      await sock.sendMessage(id, { text, mentions: cleanJids });
    }

  } catch (e) {
    console.error(chalk.red(`[GROUP UPDATE] Error en evento ${action}:`), e.message);
  }
}
