<<<<<<< HEAD
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
=======
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, "oceanfort.db");
let dbInstance = null;

async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(filebuffer);
  } else {
    dbInstance = new SQL.Database();
  }
  
  dbInstance.run(`
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
  `);
  saveDb();
}

function saveDb() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function prepare(sql) {
  if (!dbInstance) throw new Error("Database not initialized");
  return {
    get: (...params) => {
      const stmt = dbInstance.prepare(sql);
      stmt.bind(params);
      let result = undefined;
      if (stmt.step()) result = stmt.getAsObject();
      stmt.free();
      return result;
    },
    all: (...params) => {
      const stmt = dbInstance.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
      return results;
    },
    run: (...params) => {
      dbInstance.run(sql, params);
      const changes = dbInstance.getRowsModified();
      let lastInsertRowid = undefined;
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        const res = dbInstance.exec("SELECT last_insert_rowid() as id");
        if (res.length > 0 && res[0].values.length > 0) {
          lastInsertRowid = res[0].values[0][0];
        }
      }
      saveDb();
      return { changes, lastInsertRowid };
    }
  };
}

module.exports = { init, prepare };
>>>>>>> c01d573b33c3a0b111ee39ffa941a6b0a953854f
