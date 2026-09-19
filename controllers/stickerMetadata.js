import webpmux from "node-webpmux";

export async function addStickerMetadata(
  webpBuffer,
  packName = "𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝",
  author = "@Usuario"
) {
  try {
    if (!Buffer.isBuffer(webpBuffer)) {
      return webpBuffer;
    }

    const safePackName = String(packName).substring(0, 128);
    const safeAuthor = String(author).substring(0, 128);

    const img = new webpmux.Image();
    await img.load(webpBuffer);

    const json = {
      "sticker-pack-id": "com.aurareed.sticker",
      "sticker-pack-name": safePackName,
      "sticker-pack-publisher": safeAuthor,
      emojis: ["🧠"]
    };

    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);

    const jsonBuffer = Buffer.from(JSON.stringify(json), "utf-8");
    const exifBuffer = Buffer.concat([exifAttr, jsonBuffer]);
    
    exifBuffer.writeUInt32LE(jsonBuffer.length, 14);

    img.exif = exifBuffer;
    return await img.save(null);
  } catch (error) {
    console.error(error);
    return webpBuffer;
  }
}
