import { inspect } from "util";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["eval", "e", "execute"],
  category: "owner",
  ownersOnly: false,
  description:
    "Ejecuta cualquier código JavaScript en tiempo real capturando la consola.",
  async execute(
    sock,
    m,
    args,
    {
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
    },
  ) {
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

      // Si el código contiene la palabra 'await ', lo ejecutamos de forma asíncrona envolviéndolo
      if (code.includes("await ")) {
        evaled = await eval(`(async () => { ${code} })()`);
      } else {
        // Ejecución directa en el contexto global para que devuelva operaciones como "2+2" sin "undefined"
        evaled = eval(code);
      }

      if (typeof evaled !== "string" && evaled !== undefined) {
        evaled = inspect(evaled, { depth: 1 });
      }

      // Si hubo logs en consola, los muestra. Si no, muestra el resultado final obtenido.
      resultado =
        logs.length > 0
          ? logs.join("\n")
          : evaled === undefined
            ? "undefined"
            : evaled;
    } catch (err) {
      resultado = err.toString();
    } finally {
      // Restaurar la consola nativa pase lo que pase
      console.log = originalLog;
    }

    // Enviar respuesta formateada en bloque monoespaciado limpio (```)
    await sock.sendMessage(
      remoteJid,
      {
        text: `╭〔 💻 ${fytBold("EVAL RESULT")} 〕━⬣\n\n\`\`\`\n${resultado}\n\`\`\`\n\n╰━━〔 ⚡ ${fytBold("SYSTEM")} 〕━━⬣`,
      },
      { quoted: m },
    );
  },
};
