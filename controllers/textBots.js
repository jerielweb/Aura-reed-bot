import { fytBold } from "./../models/TextStyle.js";

const alertBox = (icon, title, body) => 
  `╭〔 ${icon} ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold(title)}\n╰━━━━━━━━━━━━⬣\n\n${body}\n\n╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

export const Rstr = {
  onlyAdmin: alertBox("⚠️", "ACCESO DENEGADO", "┃ > Este comando es exclusivo\n┃ > para administradores del grupo."),
  onlyOwner: alertBox("⚠️", "ACCESO DENEGADO", "┃ > Este comando es exclusivo\n┃ > para el propietario del bot."),
  onlyGroup: alertBox("❌", "ACCIÓN INCOMPATIBLE", "┃ > Este comando solo funciona en grupos."),
  onlyPrivate: alertBox("❌", "ACCIÓN INCOMPATIBLE", "┃ > Este comando solo se puede usar en privado.")
};

export const Err = {
  missingArgs: alertBox("⚠️", "FALTAN DATOS", "┃ > Faltan argumentos para este comando.\n┃ > Revisa la sintaxis e inténtalo de nuevo."),
  notAdmin: Rstr.onlyAdmin
};

export const catOff = ({ CAT_CMD = "desconocida", prefix = "." } = {}) => {
  const body = `┃ > Los comandos ${fytBold(CAT_CMD)}\n┃ > están desactivados en este grupo.\n┣━━━━━━━━━━━━⬣\n┃ > Un administrador puede activarlos con:\n┃ > \`${prefix}cmd on ${CAT_CMD}\``;
  return alertBox("⚠️", "CATEGORÍA DESACTIVADA", body);
};
