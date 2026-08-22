import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import {
  downloadStreamToFile,
  ensureDirectory,
  ffmpegSemaphore,
} from "./downloadUtils.js";
import chalk from "chalk";

ffmpeg.setFfmpegPath(ffmpegPath);

const tempDir = path.resolve("./tmp");
ensureDirectory(tempDir);

export const ALLOWED_NSFW_REACTIONS = new Set([
  "spank",
  "undress",
  "yuri",
  "sixnine",
  "anal",
  "fuck",
  "cummouth",
  "suckboobs",
  "cumshot",
  "lickpussy",
  "lickdick",
  "lickass",
  "handjob",
  "grope",
  "cum",
  "fingering",
  "creampie",
  "facesitting",
  "futanari",
  "pegging",
  "bondage",
  "deepthroat",
  "thighjob",
  "yaoi",
  "bukkake",
  "orgy",
  "grabboobs",
  "blowjob",
  "boobjob",
  "fap",
  "footjob",
  "squirting",
]);

/**
 * Obtiene la URL de la interacción NSFW desde AlyaCore.
 * @param {string} type Tipo de interacción NSFW (spank, fuck, blowjob, etc.)
 * @returns {Promise<string>} URL del gif/video
 */
export async function getNsfwReactionUrl(type) {
  const reactionType = type?.toLowerCase().trim();
  if (!ALLOWED_NSFW_REACTIONS.has(reactionType)) {
    throw new Error(`La interacción NSFW "${type}" no está soportada.`);
  }

  const key = global.Apis?.apiAiya?.apikey || "oboe";
  const res = await axios.get(
    `https://api.alyacore.xyz/nsfw/interaction?inter=${reactionType}&key=${key}`,
    {
      timeout: 10000,
      headers: {
        "User-Agent":
          "AuraReedBot/2.2.0 (https://github.com/this-xys/baileys)",
      },
    },
  );

  const url = res.data?.result;
  if (!url || res.data?.status !== true) {
    throw new Error(res.data?.message || "AlyaCore no devolvió una URL válida");
  }

  console.log(`[NSFW Reactions] Éxito: AlyaCore (${reactionType})`);
  return url;
}

/**
 * Descarga y cachea el archivo de la reacción NSFW en disco.
 * @param {string} videoUrl URL del video/gif original
 * @returns {Promise<string>} Ruta local del archivo descargado
 */
export async function getNsfwReactionPath(videoUrl) {
  if (!videoUrl) throw new Error("URL de reacción NSFW inválida.");

  const hash = crypto.createHash("md5").update(videoUrl).digest("hex");
  const ext = path.extname(new URL(videoUrl).pathname) || ".mp4";
  const localPath = path.join(tempDir, `${hash}${ext}`);

  if (fs.existsSync(localPath)) {
    console.log(`[NSFW Caché] Carga instantánea para: ${hash}`);
    return localPath;
  }

  console.log(`[NSFW Descarga] Descargando nuevo archivo: ${videoUrl}`);
  await downloadStreamToFile(videoUrl, localPath, { timeout: 20000 });
  return localPath;
}

/**
 * Convierte cualquier GIF o imagen animada a MP4 para compatibilidad con WhatsApp.
 * @param {string} inputPath Ruta del archivo de entrada
 * @returns {Promise<string>} Ruta del MP4 resultante
 */
async function ensureMp4(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  const mp4Path = inputPath.replace(/\.[^.]+$/, ".mp4");

  if (ext === ".mp4") return inputPath;

  if (fs.existsSync(mp4Path)) {
    console.log(
      chalk.gray(
        `[NSFW MP4] MP4 cacheado encontrado: ${path.basename(mp4Path)}`,
      ),
    );
    return mp4Path;
  }

  console.log(chalk.gray(`[NSFW FFmpeg] Convirtiendo ${ext} → MP4 ...`));
  await ffmpegSemaphore.run(
    () =>
      new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .videoFilters("scale=trunc(iw/2)*2:trunc(ih/2)*2")
          .outputOptions([
            "-c:v libx264",
            "-preset ultrafast",
            "-crf 23",
            "-pix_fmt yuv420p",
            "-an",
          ])
          .toFormat("mp4")
          .on("end", resolve)
          .on("error", reject)
          .save(mp4Path);
      }),
  );

  return mp4Path;
}

export async function getNsfwReactionGif(type) {
  const videoUrl = await getNsfwReactionUrl(type);
  const localPath = await getNsfwReactionPath(videoUrl);
  const ext = path.extname(localPath).toLowerCase();

  let finalPath;
  if (ext === ".gif") {
    console.log(
      chalk.gray(`[NSFW] GIF detectado -> Aplicando conversión H.264...`),
    );
    finalPath = await ensureMp4(localPath);
  } else {
    console.log(
      chalk.gray(`[NSFW] MP4 detectado -> Enviando directo sin conversión.`),
    );
    finalPath = localPath;
  }

  const buffer = await fs.promises.readFile(finalPath);
  return { video: buffer, mimetype: "video/mp4", gifPlayback: true };
}
