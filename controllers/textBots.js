//Restricciones
import { fytBold } from "./../models/TextStyle.js";

export const Rstr = {
  onlyAdmin: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("ACSESO DENEGADO")} \n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando es exclusivo\n┃ > para administradores del grupo.\n\n╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`,
  onlyOwner: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("ACSESO DENEGADO")} \n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando es exclusivo\n┃ > para el propietario del bot.\n\n╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`,
  onlyGroup: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("ACCION INCONPATIBLE")} \n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo funciona en grupos.\n\n╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`,
  onlyPrivate: "Este comando solo se puede usar en privado",
};

// Errores comunes
export const Err = {
  missingArgs:
    "Faltan argumentos para este comando. Por favor, revisa la sintaxis e inténtalo de nuevo.",
  notAdmin:
    "╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐀𝐂𝐂𝐄𝐒𝐎 𝐃𝐄𝐍𝐄𝐆𝐀𝐃𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando es exclusivo\n┃ > para administradores del grupo.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
};


export const catOff = ({ CAT_CMD, prefix }) => {
  return `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("CATEGORIA DESACTIVADA")} \n╰━━━━━━━━━━━━⬣\n\n┃ > Los comandos ${fytBold(CAT_CMD)}\n┃ > están desactivados en este grupo.\n┣━━━━━━━━━━━━⬣\n┃ > Un administrador puede\n┃ > activarlos con\n┃ > \`${prefix}cmd on ${CAT_CMD}\`\n\n╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;
};
