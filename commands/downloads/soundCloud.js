import { fytBold } from "../../models/TextStyle.js";
import axios from "axios";
import FomatTime from "./../../controllers/functions/formatTimeCont.js";
import FornatNumber from "./../../controllers/functions/formatNumbers.js";

let cachedClientId = null;
let cacheTime = null;

async function getClientId() {
  if (cachedClientId && Date.now() - cacheTime < 3600000) return cachedClientId;

  const html = await axios
    .get("https://soundcloud.com", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
      },
      timeout: 10000,
    })
    .then((r) => r.data);

  const scriptUrls = [
    ...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g),
  ].map((m) => m[1]);

  for (const scriptUrl of scriptUrls.slice(-5)) {
    try {
      const cli = await axios.get(scriptUrl).then((r) => r.data);
      const match = cli.match(/client_id:"([a-zA-Z0-9]+)"/);
      if (match) {
        cachedClientId = match[1];
        cacheTime = Date.now();
        return cachedClientId;
      }
    } catch {}
  }
  throw new Error("No se pudo obtener el client_id de SoundCloud");
}

async function searchTrackByQuery(query) {
  const clientId = await getClientId();
  const searchRes = await axios.get(
    "https://api-v2.soundcloud.com/search/tracks",
    {
      params: { q: query, client_id: clientId, limit: 1 },
      timeout: 10000,
    },
  );

  const results = searchRes.data.collection || [];
  if (!results.length)
    throw new Error("No se encontraron resultados para tu búsqueda.");

  return results[0];
}

export default {
  name: ["scplay", "scdl", "sc", "soundcloud"],
  description: "Descarga canciones de SoundCloud",
  category: "downloads",

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    let text = args.join(" ").trim();

    if (!text) {
      let errorText = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      errorText += `┃ ❌ ${fytBold("FALTA BUSQUEDA")}\n`;
      errorText += `╰━━━━━━━━━━━━⬣\n\n`;
      errorText += `┃ > Por favor, proporciona un\n`;
      errorText += `┃ > enlace de SoundCloud\n`;
      errorText += `┃ > o una busqueda.\n\n`;
      errorText += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text: errorText },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      if (!text.includes("soundcloud.com")) {
        const searchResult = await searchTrackByQuery(text);
        text = searchResult.permalink_url || searchResult.uri;
      }

      const clientId = await getClientId();

      const trackRes = await axios.get(
        "https://api-v2.soundcloud.com/resolve",
        {
          params: { url: text, client_id: clientId },
          timeout: 10000,
        },
      );

      const track = trackRes.data;

      if (!track || track.kind !== "track")
        throw new Error("No se encontró el track en esa URL");

      const transcodings = track.media?.transcodings || [];
      const mp3 = transcodings.find(
        (t) =>
          t.format?.mime_type === "audio/mpeg" &&
          t.format?.protocol === "progressive",
      );
      const hls = transcodings.find((t) => t.format?.protocol === "hls");
      const transcoding = mp3 || hls;

      if (!transcoding) throw new Error("No hay stream disponible");
      if (!mp3)
        throw new Error(
          "Este track solo tiene stream HLS, no se puede descargar de forma progresiva",
        );

      const streamRes = await axios.get(transcoding.url, {
        params: { client_id: clientId },
        timeout: 10000,
      });

      // Se usa la URL directa del stream en lugar de descargar el Buffer completo a la RAM
      const audioUrl = streamRes.data.url;
      const thumbnail = track.artwork_url?.replace("large", "t500x500") || null;

      let caption = `╭〔 ${fytBold("SOUNDCLOUD PLAY")} 〕━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(track.title)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Artista")} › ${track.user?.username || "N/A"}\n`;
      caption += `┃ > ${fytBold("Duración")} › ${FomatTime(track.duration)}\n`;
      caption += `┃ > ${fytBold("Vistas")} › ${FornatNumber(FornatNumber(track.playback_count)) || "0"}\n`;
      caption += `┃ > ${fytBold("Likes")} › ${FornatNumber(track.likes_count) || "No se"}\n`;
      caption += `┃ > ${fytBold("Tipo")} › Audio MP3\n`
      caption += `┃ > ${fytBold("Url")} › ${track.permalink_url}\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ ⏳ Enviando audio...\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      if (thumbnail) {
        await socket.sendMessage(
          remoteJid,
          { image: { url: thumbnail }, caption },
          { quoted: message },
        );
      } else {
        await socket.sendMessage(
          remoteJid,
          { text: caption },
          { quoted: message },
        );
      }

      const cleanTitle = track.title.replace(/[<>:"/\\|?*]/g, "");
    
      await socket.sendMessage(
        remoteJid,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          fileName: `${cleanTitle}.mp3`,
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error(error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        { text: `❌ Error: ${error.message}` },
        { quoted: message },
      );
    }
  },
};
