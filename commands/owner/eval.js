import { inspect } from "util";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["eval", "e", "execute"],
  category: "owner",
  ownersOnly: true,
  description:
    "Ejecuta cualquier código JavaScript con acceso total al entorno y consultas en vivo.",
  async execute(sock, m, args, context, {groupMetadata, prefix, db}) {
    const remoteJid = m.key.remoteJid;
    const code = args.join(" ").trim();

    if (!code) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA CÓDIGO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, ingresa el código a evaluar.\n┃ > Ejemplo: *${context?.prefix || "."}eval 2 + 2*\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: m },
      );
    }

    let logs = [];
    const originalLog = console.log;

    console.log = (...argsLog) => {
      logs.push(
        argsLog
          .map((arg) =>
            typeof arg === "object" ? inspect(arg, { depth: 1 }) : arg,
          )
          .join(" "),
      );
      originalLog(...argsLog);
    };

    let resultado;
    try {
      // Helpers avanzados y seguros dentro del eval:
      const send = (texto, options = {}) => sock.sendMessage(remoteJid, { text: texto, ...options }, { quoted: m });
      const reply = (texto) => sock.sendMessage(remoteJid, { text: texto }, { quoted: m });
      const sender = m.key.participant || m.key.remoteJid;
      
      // Obtener groupMetadata en vivo si estamos en un grupo (evita que sea undefined)
      let groupMetadata = context?.groupMetadata;
      if (!groupMetadata && remoteJid.endsWith("@g.us")) {
        try {
          groupMetadata = await sock.groupMetadata(remoteJid);
        } catch (e) {
          groupMetadata = null;
        }
      }

      // Obtener info del mensaje citado (reply) de forma limpia
      const ctxInfo = m.message?.extendedTextMessage?.contextInfo;
      const quoted = {
        participant: ctxInfo?.participant || null,
        stanzaId: ctxInfo?.stanzaId || null,
        mentionedJid: ctxInfo?.mentionedJid || []
      };

      // Extrayendo el resto del contexto de forma segura
      const db = context?.db || {};
      const saveDB = context?.saveDB || (() => {});
      const prefix = context?.prefix || ".";

      // Ejecución segura inyectando todo el entorno enriquecido
      const executeFn = new Function(
        'sock', 'm', 'args', 'remoteJid', 'db', 'saveDB', 'prefix', 'groupMetadata', 'quoted', 'send', 'reply', 'sender', 'inspect',
        `return (async () => { ${code} })();`
      );

      evaled = await executeFn(
        sock, m, args, remoteJid, db, saveDB, prefix, groupMetadata, quoted, send, reply, sender, inspect
      );

      if (typeof evaled !== "string" && evaled !== undefined) {
        evaled = inspect(evaled, { depth: 1 });
      }

      resultado =
        logs.length > 0
          ? logs.join("\n")
          : evaled === undefined
            ? "undefined"
            : evaled;
    } catch (err) {
      resultado = err.toString();
    } finally {
      console.log = originalLog;
    }

    await sock.sendMessage(
      remoteJid,
      {
        text: `╭〔 💻 ${fytBold("EVAL RESULT")} 〕━⬣\n\n\`\`\`\n${resultado}\n\`\`\`\n\n╰━━〔 ⚡ ${fytBold("SYSTEM")} 〕━━⬣`,
      },
      { quoted: m },
    );
  },
};
