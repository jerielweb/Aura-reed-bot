import yt from "@vreden/youtube_scraper";

async function testVideo() {
  try {
    const url = "https://youtu.be/QqJ9zrY_ITw"; // Puedes cambiar el enlace aquí
    console.log("Obteniendo video...");
    
    // La librería usa yt.ytmp4 para videos
    const res = await yt.ytmp4(url);
    
    console.log("Resultado completo:", JSON.stringify(res, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

testVideo();
