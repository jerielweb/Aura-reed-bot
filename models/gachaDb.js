import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATABASE_DIR = path.resolve("./database");
const DB_FILE = path.join(DATABASE_DIR, "gacha.sqlite3");

if (!fs.existsSync(DATABASE_DIR)) fs.mkdirSync(DATABASE_DIR, { recursive: true });

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS gacha_characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    series TEXT NOT NULL,
    gender TEXT NOT NULL,
    booru_tag TEXT NOT NULL,
    value INTEGER NOT NULL,
    rarity TEXT NOT NULL DEFAULT 'common',
    UNIQUE(name, series)
  );
  CREATE TABLE IF NOT EXISTS gacha_ownership (
    user_id TEXT NOT NULL,
    char_id INTEGER NOT NULL,
    obtained_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, char_id)
  );
  CREATE TABLE IF NOT EXISTS gacha_favorites (
    user_id TEXT PRIMARY KEY,
    char_id INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS gacha_stats (
    user_id TEXT PRIMARY KEY,
    total_rolls INTEGER NOT NULL DEFAULT 0,
    total_claimed INTEGER NOT NULL DEFAULT 0,
    total_sold INTEGER NOT NULL DEFAULT 0,
    total_value INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS gacha_daily (
    user_id TEXT PRIMARY KEY,
    last_date TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS gacha_shop (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller TEXT NOT NULL,
    char_id INTEGER NOT NULL,
    price INTEGER NOT NULL,
    listed_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS gacha_wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    char_name TEXT NOT NULL,
    series TEXT NOT NULL
  );
`);

const RARITY_EMOJI = {
  common: "⚪",
  rare: "🔵",
  epic: "🟣",
  legendary: "🟡",
  mythic: "🔴",
};

function computeRarity(value) {
  if (value >= 15000) return "mythic";
  if (value >= 9000) return "legendary";
  if (value >= 6500) return "epic";
  if (value >= 4500) return "rare";
  return "common";
}

function rowToChar(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    series: row.series,
    gender: row.gender,
    booru_tag: row.booru_tag,
    value: row.value,
    rarity: row.rarity || "common",
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getGachaStats(userId) {
  const row = db.prepare("SELECT * FROM gacha_stats WHERE user_id = ?").get(userId);
  if (!row) return { totalRolls: 0, totalClaimed: 0, totalSold: 0, totalValue: 0 };
  return {
    totalRolls: row.total_rolls,
    totalClaimed: row.total_claimed,
    totalSold: row.total_sold,
    totalValue: row.total_value,
  };
}

function updateGachaStats(userId, fn) {
  const stats = getGachaStats(userId);
  fn(stats);
  db.prepare(
    `INSERT INTO gacha_stats (user_id, total_rolls, total_claimed, total_sold, total_value)
     VALUES (?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET
       total_rolls = excluded.total_rolls,
       total_claimed = excluded.total_claimed,
       total_sold = excluded.total_sold,
       total_value = excluded.total_value`,
  ).run(userId, stats.totalRolls, stats.totalClaimed, stats.totalSold, stats.totalValue);
}

function getRandomCharacter() {
  const row = db.prepare("SELECT * FROM gacha_characters ORDER BY RANDOM() LIMIT 1").get();
  return rowToChar(row);
}

function getCharacterCount() {
  return db.prepare("SELECT COUNT(*) as c FROM gacha_characters").get().c;
}

function searchCharacters(query) {
  const q = `%${query}%`;
  const rows = db
    .prepare("SELECT * FROM gacha_characters WHERE name LIKE ? OR series LIKE ? LIMIT 50")
    .all(q, q);
  return rows.map(rowToChar);
}

function addCharacter({ name, series, gender, booru_tag, value }) {
  const dup = db.prepare("SELECT 1 FROM gacha_characters WHERE name = ? AND series = ?").get(name, series);
  if (dup) throw new Error("DUPLICATE_CHARACTER");
  const rarity = computeRarity(value);
  db.prepare(
    "INSERT INTO gacha_characters (name, series, gender, booru_tag, value, rarity) VALUES (?,?,?,?,?,?)",
  ).run(name, series, gender, booru_tag, value, rarity);
}

function giveCharacter(userId, charId) {
  const owns = db.prepare("SELECT 1 FROM gacha_ownership WHERE user_id = ? AND char_id = ?").get(userId, charId);
  if (owns) throw new Error("CHARACTER_ALREADY_OWNED");
  db.prepare("INSERT INTO gacha_ownership (user_id, char_id, obtained_at) VALUES (?,?,?)").run(
    userId,
    charId,
    Date.now(),
  );
  return true;
}

function getUserHarem(userId) {
  const rows = db
    .prepare(
      `SELECT c.* FROM gacha_ownership o
       JOIN gacha_characters c ON c.id = o.char_id
       WHERE o.user_id = ?
       ORDER BY o.obtained_at ASC`,
    )
    .all(userId);
  return rows.map(rowToChar);
}

function getUserHaremCount(userId) {
  return db.prepare("SELECT COUNT(*) as c FROM gacha_ownership WHERE user_id = ?").get(userId).c;
}

function getFavorite(userId) {
  const row = db
    .prepare(
      `SELECT c.* FROM gacha_favorites f
       JOIN gacha_characters c ON c.id = f.char_id
       WHERE f.user_id = ?`,
    )
    .get(userId);
  return rowToChar(row);
}

function setFavorite(userId, charId) {
  const owns = db.prepare("SELECT 1 FROM gacha_ownership WHERE user_id = ? AND char_id = ?").get(userId, charId);
  if (!owns) throw new Error("CHARACTER_NOT_OWNED");
  db.prepare(
    `INSERT INTO gacha_favorites (user_id, char_id) VALUES (?,?)
     ON CONFLICT(user_id) DO UPDATE SET char_id = excluded.char_id`,
  ).run(userId, charId);
}

function removeFavorite(userId) {
  db.prepare("DELETE FROM gacha_favorites WHERE user_id = ?").run(userId);
}

function hasUsedDailyRoll(userId) {
  const row = db.prepare("SELECT last_date FROM gacha_daily WHERE user_id = ?").get(userId);
  return !!row && row.last_date === todayStr();
}

function setDailyRollUsed(userId) {
  db.prepare(
    `INSERT INTO gacha_daily (user_id, last_date) VALUES (?,?)
     ON CONFLICT(user_id) DO UPDATE SET last_date = excluded.last_date`,
  ).run(userId, todayStr());
}

function sellCharacter(userId, charId) {
  const owns = db.prepare("SELECT 1 FROM gacha_ownership WHERE user_id = ? AND char_id = ?").get(userId, charId);
  if (!owns) throw new Error("CHARACTER_NOT_OWNED");
  const char = db.prepare("SELECT * FROM gacha_characters WHERE id = ?").get(charId);
  const price = Math.floor(char.value * (0.5 + Math.random() * 0.2));

  db.prepare("DELETE FROM gacha_ownership WHERE user_id = ? AND char_id = ?").run(userId, charId);
  const favRow = db.prepare("SELECT char_id FROM gacha_favorites WHERE user_id = ?").get(userId);
  if (favRow && favRow.char_id === charId) removeFavorite(userId);

  updateGachaStats(userId, (s) => {
    s.totalSold += price;
  });

  return price;
}

function fusionCharacters(userId, id1, id2) {
  const own1 = db.prepare("SELECT 1 FROM gacha_ownership WHERE user_id = ? AND char_id = ?").get(userId, id1);
  const own2 = db.prepare("SELECT 1 FROM gacha_ownership WHERE user_id = ? AND char_id = ?").get(userId, id2);
  if (!own1 || !own2) throw new Error("CHARACTER_NOT_OWNED");

  const c1 = db.prepare("SELECT * FROM gacha_characters WHERE id = ?").get(id1);
  const c2 = db.prepare("SELECT * FROM gacha_characters WHERE id = ?").get(id2);

  const bonus = 1.15 + Math.random() * 0.15;
  const value = Math.floor((c1.value + c2.value) * bonus);
  const rarity = computeRarity(value);
  const name = `${c1.name} × ${c2.name}`;
  const series = "Fusión";

  let fusedId;
  const existing = db.prepare("SELECT id FROM gacha_characters WHERE name = ? AND series = ?").get(name, series);
  if (existing) {
    fusedId = existing.id;
    db.prepare("UPDATE gacha_characters SET value = ?, rarity = ? WHERE id = ?").run(value, rarity, fusedId);
  } else {
    const info = db
      .prepare(
        "INSERT INTO gacha_characters (name, series, gender, booru_tag, value, rarity) VALUES (?,?,?,?,?,?)",
      )
      .run(name, series, c1.gender, c1.booru_tag, value, rarity);
    fusedId = info.lastInsertRowid;
  }

  db.prepare("DELETE FROM gacha_ownership WHERE user_id = ? AND char_id IN (?,?)").run(userId, id1, id2);
  const favRow = db.prepare("SELECT char_id FROM gacha_favorites WHERE user_id = ?").get(userId);
  if (favRow && (favRow.char_id === id1 || favRow.char_id === id2)) removeFavorite(userId);

  db.prepare("INSERT OR IGNORE INTO gacha_ownership (user_id, char_id, obtained_at) VALUES (?,?,?)").run(
    userId,
    fusedId,
    Date.now(),
  );

  return rowToChar(db.prepare("SELECT * FROM gacha_characters WHERE id = ?").get(fusedId));
}

function getRarityEmoji(rarity) {
  return RARITY_EMOJI[rarity || "common"] || "⚪";
}

function getShopListings() {
  const rows = db
    .prepare(
      `SELECT s.id as shop_id, s.seller, s.price, c.* FROM gacha_shop s
       JOIN gacha_characters c ON c.id = s.char_id
       ORDER BY s.listed_at ASC`,
    )
    .all();
  return rows.map((r) => ({
    shopId: r.shop_id,
    seller: r.seller,
    price: r.price,
    char: rowToChar(r),
  }));
}

function listInShop(userId, charId, price) {
  const owns = db.prepare("SELECT 1 FROM gacha_ownership WHERE user_id = ? AND char_id = ?").get(userId, charId);
  if (!owns) throw new Error("CHARACTER_NOT_OWNED");
  db.prepare("DELETE FROM gacha_ownership WHERE user_id = ? AND char_id = ?").run(userId, charId);
  const favRow = db.prepare("SELECT char_id FROM gacha_favorites WHERE user_id = ?").get(userId);
  if (favRow && favRow.char_id === charId) removeFavorite(userId);
  db.prepare("INSERT INTO gacha_shop (seller, char_id, price, listed_at) VALUES (?,?,?,?)").run(
    userId,
    charId,
    price,
    Date.now(),
  );
}

function buyFromShop(userId, index) {
  const listings = getShopListings();
  const listing = listings[index];
  if (!listing) throw new Error("LISTING_NOT_FOUND");
  if (listing.seller === userId) throw new Error("CANNOT_BUY_OWN_LISTING");
  db.prepare("DELETE FROM gacha_shop WHERE id = ?").run(listing.shopId);
  db.prepare("INSERT OR IGNORE INTO gacha_ownership (user_id, char_id, obtained_at) VALUES (?,?,?)").run(
    userId,
    listing.char.id,
    Date.now(),
  );
  return { char: listing.char, seller: listing.seller, price: listing.price };
}

function unlistFromShop(userId, index) {
  const listings = getShopListings();
  const listing = listings[index];
  if (!listing) throw new Error("LISTING_NOT_FOUND");
  if (listing.seller !== userId) throw new Error("NOT_YOUR_LISTING");
  db.prepare("DELETE FROM gacha_shop WHERE id = ?").run(listing.shopId);
  db.prepare("INSERT OR IGNORE INTO gacha_ownership (user_id, char_id, obtained_at) VALUES (?,?,?)").run(
    userId,
    listing.char.id,
    Date.now(),
  );
  return listing.char;
}

function transferCharacter(fromUserId, toUserId, charId) {
  const owns = db.prepare("SELECT 1 FROM gacha_ownership WHERE user_id = ? AND char_id = ?").get(fromUserId, charId);
  if (!owns) throw new Error("CHARACTER_NOT_OWNED");
  const targetOwns = db
    .prepare("SELECT 1 FROM gacha_ownership WHERE user_id = ? AND char_id = ?")
    .get(toUserId, charId);
  if (targetOwns) throw new Error("TARGET_ALREADY_OWNS");

  db.prepare("DELETE FROM gacha_ownership WHERE user_id = ? AND char_id = ?").run(fromUserId, charId);
  const favRow = db.prepare("SELECT char_id FROM gacha_favorites WHERE user_id = ?").get(fromUserId);
  if (favRow && favRow.char_id === charId) removeFavorite(fromUserId);

  db.prepare("INSERT INTO gacha_ownership (user_id, char_id, obtained_at) VALUES (?,?,?)").run(
    toUserId,
    charId,
    Date.now(),
  );
}

function getWishlist(userId) {
  return db
    .prepare("SELECT id, char_name as charName, series FROM gacha_wishlist WHERE user_id = ? ORDER BY id ASC")
    .all(userId);
}

function addWish(userId, charName, series) {
  const dup = db
    .prepare("SELECT 1 FROM gacha_wishlist WHERE user_id = ? AND char_name = ? AND series = ?")
    .get(userId, charName, series);
  if (dup) throw new Error("ALREADY_IN_WISHLIST");
  db.prepare("INSERT INTO gacha_wishlist (user_id, char_name, series) VALUES (?,?,?)").run(userId, charName, series);
}

function removeWish(userId, index) {
  const list = getWishlist(userId);
  const item = list[index];
  if (!item) return false;
  db.prepare("DELETE FROM gacha_wishlist WHERE id = ?").run(item.id);
  return true;
}

function matchWishlist(charName, series) {
  const rows = db
    .prepare("SELECT user_id as userId, char_name as charName, series FROM gacha_wishlist WHERE char_name LIKE ?")
    .all(`%${charName}%`);
  return rows;
}

function getAllHaremData() {
  const rows = db
    .prepare(
      `SELECT o.user_id as userId, COUNT(*) as count, SUM(c.value) as totalValue
       FROM gacha_ownership o
       JOIN gacha_characters c ON c.id = o.char_id
       GROUP BY o.user_id`,
    )
    .all();
  return rows.map((r) => ({ userId: r.userId, count: r.count, totalValue: r.totalValue || 0 }));
}

export const gacha = {
  getRandomCharacter,
  getCharacterCount,
  searchCharacters,
  addCharacter,
  giveCharacter,
  getUserHarem,
  getUserHaremCount,
  getFavorite,
  setFavorite,
  removeFavorite,
  hasUsedDailyRoll,
  setDailyRollUsed,
  sellCharacter,
  fusionCharacters,
  getRarityEmoji,
  getShopListings,
  listInShop,
  buyFromShop,
  unlistFromShop,
  transferCharacter,
  getWishlist,
  addWish,
  removeWish,
  matchWishlist,
  getAllHaremData,
  getGachaStats,
  updateGachaStats,
};
