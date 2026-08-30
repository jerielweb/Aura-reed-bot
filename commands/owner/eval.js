import { inspect } from "util";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["eval", "e", "execute"],
  category: "owner",
  ownersOnly: true, // Recomendado que sea true por seguridad (solo tú puedes ejecutar código)
  description:
    "Ejecuta cualquier código JavaScript en tiempo real con acceso total al entorno.",
  async execute(
    sock,
    m,
    args,
    context, // Recibimos el objeto de contexto completo
  ) {
    const {
      prefix,
      db,
      saveDB,
      isOwner,
      isAdmin,
      isBotAdmin,
      owners,
      groupMetadata,
      numeroReal,
      jidRemitente,
    } = context;

    const remoteJid = m.key.remoteJid;
    const code = args.join(" ").trim();

    if (!code) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA CÓDIGO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, ingresa el código a evaluar.\n┃ > Ejemplo: *${prefix}eval 2 + 2*\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: m },
      );
    }

    let logs = [];
    const originalLog = console.log;

    // Interceptar console.log para capturarlos en el reporte de WhatsApp
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
      let evaled;

      // Definimos alias de ayuda rápida accesibles dentro del eval
      const send = (texto, options = {}) => sock.sendMessage(remoteJid, { text: texto, ...options }, { quoted: m });
      const reply = (texto) => sock.sendMessage(remoteJid, { text: texto }, { quoted: m });
      const sender = m.key.participant || m.key.remoteJid;

      // Ejecución segura envolviendo el código en una función asíncrona que inyecta todo el entorno
      const executeFn = new Function(
        'sock', 'm', 'args', 'remoteJid', 'db', 'saveDB', 'isOwner', 'isAdmin', 'isBotAdmin', 'owners', 'groupMetadata', 'numeroReal', 'jidRemitente', 'send', 'reply', 'sender', 'inspect',
        `return (async () => { ${code} })();`
      );

      evaled = await executeFn(
        sock, m, args, remoteJid, db, saveDB, isOwner, isAdmin, isBotAdmin, owners, groupMetadata, numeroReal, jidRemitente, send, reply, sender, inspect
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
