import { fytBold } from "./TextStyle.js";

/**
 * Construye una caja de texto con el estilo visual de Aura Reed.
 * @param {string} emoji - Emoji representativo del mensaje.
 * @param {string} title - Título principal.
 * @param {string} [subtitle] - Subtítulo opcional.
 * @param {string[]} [fields] - Líneas de contenido.
 * @param {string} [tip] - Nota/consejo final.
 */
export function box(emoji, title, subtitle, fields = [], tip) {
  let text = `╭〔 ${emoji} ${fytBold("GACHA")} 〕⬣\n`;
  text += `┃ ${fytBold(String(title || "").toUpperCase())}\n`;
  text += `╰━━━━━━━━━━━━⬣\n\n`;

  if (subtitle) {
    text += `┃ ${subtitle}\n\n`;
  }

  if (fields && fields.length) {
    for (const line of fields) {
      text += line === "" ? `┃\n` : `┃ ${line}\n`;
    }
    text += `\n`;
  }

  if (tip) {
    text += `> ${tip}\n\n`;
  }

  text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
  return text;
}
