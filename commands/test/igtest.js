import { downloadInstagram, IG_REGEX } from '../../instagram-downloader.js';
import { fytBold } from '../../models/TextStyle.js';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import fetch from 'node-fetch';

export default {
  name: ["igtest", "instagramtest"],
  category: "downloads",
  description: "Prueba el módulo de descarga de Instagram descargando localmente tanto videos como imágenes.",
  
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text || !IG_REGEX.test(text)) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA ENLACE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un enlace\n┃ > válido de Instagram.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
    
    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    const tempDir = path.resolve('./temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFiles = [];

    try {
      const result = await downloadInstagram(text);

      if (result.type === 'video') {
        const fileName = `ig_${Date.now()}.mp4`;
        const filePath = path.join(tempDir, fileName);
        tempFiles.push(filePath);

        const response = await fetch(result.downloadUrl);
        if (!response.ok) throw new Error(`Falló la descarga del archivo (HTTP ${response.status})`);
        
        const fileStream = fs.createWriteStream(filePath);
        await pipeline(response.body, fileStream);

        let caption = `╭〔 📸 ${fytBold("INSTAGRAM VIDEO")} 〕━⬣\n\n`;
        caption += `┃ ➥ ${fytBold(result.title || "Sin título")}\n\n`;
        caption += `┣━━━━━━━━━━━━⬣\n`;
        caption += `┃ > ${fytBold("Calidad")} › ${result.quality}\n`;
        caption += `┃ > ${fytBold("Duración")} › ${result.duration}s\n`;
        caption += `╰〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕⬣`;

        await socket.sendMessage(
          remoteJid,
          {
            video: fs.readFileSync(filePath),
            mimetype: "video/mp4",
            caption: caption
          },
          { quoted: message }
        );
      } else if (result.type === 'images') {
        await socket.sendMessage(
          remoteJid,
          {
            text: `╭〔 📸 ${fytBold("INSTAGRAM")} 〕⬣\n┃ Descargando ${result.images.length} imágenes... \n╰━━━━━━━━━━━━⬣`
          },
          { quoted: message }
        );

        for (let i = 0; i < result.images.length; i++) {
          const imgUrl = result.images[i];
          const fileName = `ig_img_${Date.now()}_${i}.jpg`;
          const filePath = path.join(tempDir, fileName);
          tempFiles.push(filePath);

          const response = await fetch(imgUrl);
          if (!response.ok) continue;

          const fileStream = fs.createWriteStream(filePath);
          await pipeline(response.body, fileStream);

          await socket.sendMessage(
            remoteJid,
            { 
              image: fs.readFileSync(filePath),
              caption: i === 0 ? fytBold(result.title || "") : ""
            },
            { quoted: message }
          );
        }
      }

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en igtest:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });

      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    } finally {
      for (const filePath of tempFiles) {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            // Ignorar errores de limpieza
          }
        }
      }
    }
  },
};
