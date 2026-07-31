import { fytBold } from "../../models/TextStyle.js";
import {
  fetchJson,
  firstSuccessfulPromise,
} from "../../controllers/downloadUtils.js";

export default {
  name: ["chatgpt", "ia", "gpt"],
  description: "Habla con ChatGPT",
  category: "AI",

  execute: async (sock, message, args, { prefix }) => {
    const remotxeJid = message.key.remoteJid;
    const prompt =
      typeof args === "string"
        ? args
        : Array.isArray(args)
          ? args.join(" ")
          : "";
    if (!prompt) {
      let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("FALTA MENSAJE")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Debes escribir un mensaje para\n`;
      text += `┃ > que ChatGPT pueda responderte.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;

      return sock.sendMessage(
        message.key.remoteJid,
        { text },
        { quoted: message },
      );
    }

    await sock.sendMessage(message.key.remoteJid, {
      react: { text: "🤖", key: message.key },
    });

    const copilotUrls = [
      `https://api.alyacore.xyz/ai/chatgpt?text=${encodeURIComponent(prompt)}&key=${global.Apis.apiAiya.apikey}`
    ];

    const extractText = (data) => {
      if (!data) return null;
      if (typeof data === "string") return data;
      const textFields = [
        "result",
        "text",
        "response",
        "message",
        "reply",
        "answer",
        "data",
      ];
      for (const field of textFields) {
        if (typeof data[field] === "string" && data[field].trim()) {
          return data[field].trim();
        }
      }
      if (typeof data.data === "string" && data.data.trim())
        return data.data.trim();
      if (typeof data.data === "object" && data.data !== null) {
        for (const field of textFields) {
          if (typeof data.data[field] === "string" && data.data[field].trim()) {
            return data.data[field].trim();
          }
        }
      }
      return JSON.stringify(data, null, 2);
    };

    try {
      await sock.sendPresenceUpdate("composing", remotxeJid);
      const response = await firstSuccessfulPromise(
        copilotUrls.map((url) => fetchJson(url, 20000)),
      );
      const reply = extractText(response);
      if (!reply) {
        throw new Error("La respuesta de ChatGPT no contiene texto válido.");
      }
      let resultText = `╭〔 🤖 ${fytBold("CHATGPT AI")} 〕⬣\n\n`;
      resultText += `${reply}\n\n`;
      resultText += `╰〔 ⚡ ${fytBold("SYSTEM AI")} 〕⬣`;

      await sock.sendPresenceUpdate("paused", remotxeJid);
      return sock.sendMessage(
        message.key.remoteJid,
        { text: resultText },
        { quoted: message },
      );
    } catch (error) {
      console.error("Error al obtener respuesta de ChatGPT:", error);
      await sock.sendPresenceUpdate("paused", remotxeJid);
      return sock.sendMessage(
        message.key.remoteJid,
        {
          text: `❌ ${fytBold("ERROR AL OBTENER RESPUESTA")} ❌\n\n> ${error.message || error}`,
        },
        { quoted: message },
      );
    }
  },
};
