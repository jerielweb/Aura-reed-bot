import mongoose from "mongoose";
import fs from "fs";

const settingsSchema = new mongoose.Schema({
  id: { type: String, default: "main_config" },
  prefix: { type: String, default: "!" },
});

const Settings = mongoose.models.Settings || mongoose.model("Settings", settingsSchema);

let pkgVersion = "1.0.0";
try {
  pkgVersion = JSON.parse(fs.readFileSync("./package.json", "utf-8")).version;
} catch {}

global.chanellink = "https://api.alyacore.xyz/a/10bfc2";
global.version = pkgVersion;

global.Apis = {
  apiCausa: {
    apikey: "oboe",
    url: "https://rest.apicausas.xyz/",
  },
  apiAiya: {
    apikey: "oboe",
    url: "https://api.alyacore.xyz/",
  },
  appiFaa: {
    apikey: null,
    url: "https://api-faa.my.id/",
  },
  deliriusApi: {
    apikey: null,
    url: "https://api.delirius.online/",
  },
};

global.youtubeApis = {
  alyacore: {
    url: "https://api.alyacore.xyz/search/yt",
    apikey: "oboe",
  },
  delirius: {
    url: "https://api.delirius.store/search/ytsearch",
  },
};

global.tiktokApis = {
  alyacore: {
    url: "https://api.alyacore.xyz/search/tiktok",
    apikey: "oboe",
  },
  delirius: {
    url: "https://api.delirius.store/search/tiktoksearch",
  },
};

global.apiShazam = {
  url: "https://api.audd.io/",
  apikey: "07887abb3c387183d5f3be932f3445d5",
};

export default Settings;
