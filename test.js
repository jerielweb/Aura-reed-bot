import TikTok from "@tobyg74/tiktok-api-dl";

async function testVideo() {
  try {
    const url = "https://vt.tiktok.com/ZSVHkGC1n/"; // Puedes cambiar el enlace aquí
    console.log("Obteniendo video...");
    
    // La librería usa yt.ytmp4 para videos
    TikTok.Downloader(url, {
      version: "v1",
      showOriginalResponse: true
    }).then((result) => console.log(result))
  } catch(error) {
    console.error(error)
  }
}

testVideo();
