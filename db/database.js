const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "oceanfort.db");
let db = null;

function init() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);

      db.run("PRAGMA journal_mode = WAL;", (err) => {
        if (err) return reject(err);
        db.run("PRAGMA foreign_keys = ON;", (err) => {
          if (err) return reject(err);

          db.exec(`
            CREATE TABLE IF NOT EXISTS bookings (
              id          INTEGER PRIMARY KEY AUTOINCREMENT,
              checkin     TEXT NOT NULL,
              checkout    TEXT NOT NULL,
              guests      TEXT NOT NULL,
              room_type   TEXT NOT NULL,
              name        TEXT NOT NULL,
              email       TEXT NOT NULL,
              total_price INTEGER DEFAULT 0,
              status      TEXT DEFAULT 'pending',
              created_at  TEXT DEFAULT (datetime('now','localtime'))
            );
            CREATE TABLE IF NOT EXISTS contacts (
              id           INTEGER PRIMARY KEY AUTOINCREMENT,
              name         TEXT NOT NULL,
              email        TEXT NOT NULL,
              inquiry_type TEXT NOT NULL,
              message      TEXT NOT NULL,
              status       TEXT DEFAULT 'unread',
              created_at   TEXT DEFAULT (datetime('now','localtime'))
            );
          `, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    });
  });
}

function prepare(sql) {
  if (!db) throw new Error("Database not initialized — call init() first.");

  return {
    get: (...params) => {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    },
    all: (...params) => {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    },
    run: (...params) => {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
  };
}

module.exports = { init, prepare };
