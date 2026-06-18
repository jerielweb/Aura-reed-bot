import webpmux from 'node-webpmux';

/**
 * @param {Buffer} webpBuffer
 * @param {string} [packName]
 * @param {string} [author]
 * @returns {Promise<Buffer>}
 */
export async function addStickerMetadata(webpBuffer, packName = '𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝', author = '@Usuario') {
    try {
        const img = new webpmux.Image();
        await img.load(webpBuffer);
        
        const json = {
            "sticker-pack-id": "com.aurareed.sticker",
            "sticker-pack-name": packName,
            "sticker-pack-publisher": author,
            "emojis": ["🧠"]
        };
        
        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 
            0x01, 0x00, 
            0x41, 0x57, 
            0x07, 0x00, 
            0x00, 0x00, 0x00, 0x00, 
            0x16, 0x00, 0x00, 0x00
        ]);
        
        const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8');
        const exifBuffer = Buffer.concat([exifAttr, jsonBuffer]);
        exifBuffer.writeUInt32LE(jsonBuffer.length, 14);
        
        img.exif = exifBuffer;
        return await img.save(null);
    } catch (error) {
        console.error('[stickerMetadata] Error inyectando metadatos:', error);
        return webpBuffer;
    }
}
