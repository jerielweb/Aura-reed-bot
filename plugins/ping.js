import { prepareWAMessageMedia } from "@fer2809fl/baileys";

export default [
  {
    command: ["ping", "status"],
    description: "Muestra el ping del bot.",
    async execute({ sock, msg, remoteJid, reply }) {
      const start = Date.now();
      await sock.sendPresenceUpdate("available");
      const ping = Date.now() - start;

      const texto =
        `🏓 *Pong!*\n\n` +
        `📶 *Velocidad:* ${ping} ms\n` +
        `🤖 *Bot:* ${global.botname}`;

      try {
        // Genera la miniatura del link preview a partir del logo del bot,
        // igual que en tu ejemplo (thumbnail-link vía waUploadToServer).
        const { imageMessage } = global.logo
          ? await prepareWAMessageMedia(
              { image: { url: global.logo } },
              { upload: sock.waUploadToServer, mediaTypeOverride: "thumbnail-link" }
            )
          : {};

        await sock.sendMessage(
          remoteJid,
          {
            text: texto,
            linkPreview: global.repo
              ? {
                  "canonical-url": global.repo,
                  "matched-text": global.repo,
                  title: global.botname,
                  description: global.wm,
                  // Solo jpegThumbnail (sin highQualityThumbnail) = vista
                  // previa chica, como un link preview normal de WhatsApp.
                  jpegThumbnail: imageMessage?.jpegThumbnail
                    ? Buffer.from(imageMessage.jpegThumbnail)
                    : undefined,
                }
              : undefined,
            contextInfo: {
              mentionedJid: [remoteJid.endsWith("@g.us") ? msg.key.participant || msg.key.remoteJid : msg.key.remoteJid],
              isForwarded: true,
              forwardingScore: 999,
              forwardedNewsletterMessageInfo: global.canal?.id
                ? {
                    newsletterJid: global.canal.id,
                    serverMessageId: 0,
                    newsletterName: global.canal.nombre,
                  }
                : undefined,
            },
          },
          { quoted: msg }
        );
      } catch (e) {
        // Si falla el preview (ej. no hay logo/red), no dejamos el comando
        // roto: caemos al texto simple.
        console.error("[ping] Error generando el link preview:", e.message);
        await reply(texto);
      }
    },
  },
];
