const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { insertSensorData } = require('./clickhouse');

const dbPath = path.resolve(__dirname, 'flow_intel.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

const initDb = () => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS flow_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        house_id TEXT NOT NULL,
        flow_rate REAL NOT NULL,
        pressure REAL NOT NULL,
        status TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS current_status (
        house_id TEXT PRIMARY KEY,
        flow_rate REAL NOT NULL,
        pressure REAL NOT NULL,
        status TEXT NOT NULL,
        last_updated TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS house_stats (
        house_id TEXT PRIMARY KEY,
        cumulative_flow_liters REAL DEFAULT 0,
        fault_count INTEGER DEFAULT 0
      )
    `);

    // Wipe out the old dummy data so the demo starts totally fresh!
    db.run(`DELETE FROM flow_data`);
    db.run(`DELETE FROM current_status`);
    db.run(`DELETE FROM house_stats`);
  });
};

const storeReading = (reading) => {
  const { house_id, flow_rate, pressure, status, timestamp } = reading;

  // Dual-Write: Stream historical telemetry securely to Aiven ClickHouse
  insertSensorData(reading);

  db.serialize(() => {
    db.run(
      `INSERT INTO flow_data (house_id, flow_rate, pressure, status, timestamp) VALUES (?, ?, ?, ?, ?)`,
      [house_id, flow_rate, pressure, status, timestamp],
    );

    db.run(
      `INSERT OR REPLACE INTO current_status (house_id, flow_rate, pressure, status, last_updated) VALUES (?, ?, ?, ?, ?)`,
      [house_id, flow_rate, pressure, status, timestamp],
    );

    // Fast accumulation for demo purposes (adds the L/min value directly each tick)
    const isFault = (status !== 'Normal' && status !== 'No Flow') ? 1 : 0;
    db.run(
      `INSERT INTO house_stats (house_id, cumulative_flow_liters, fault_count) 
       VALUES (?, ?, ?) 
       ON CONFLICT(house_id) DO UPDATE SET 
       cumulative_flow_liters = cumulative_flow_liters + excluded.cumulative_flow_liters,
       fault_count = fault_count + excluded.fault_count`,
      [house_id, flow_rate, isFault]
    );
  });
};

const getLatestReadings = (cb) => {
  db.all(
    `SELECT house_id, flow_rate, pressure, status, last_updated AS timestamp FROM current_status`,
    [],
    (err, rows) => {
      if (err) {
        console.error(err.message);
        cb([]);
      } else {
        cb(rows);
      }
    },
  );
};

const getReadingHistory = ({ houseId, limit = 24 }, cb) => {
  db.all(
    `
      SELECT house_id, flow_rate, pressure, status, timestamp
      FROM flow_data
      WHERE house_id = ?
      ORDER BY datetime(timestamp) DESC
      LIMIT ?
    `,
    [houseId, limit],
    (err, rows) => {
      if (err) {
        console.error(err.message);
        cb([]);
      } else {
        cb(rows);
      }
    },
  );
};

const getHouseStats = (cb) => {
  db.all(`SELECT house_id, cumulative_flow_liters, fault_count FROM house_stats`, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      cb([]);
    } else {
      cb(rows);
    }
  });
};

module.exports = { initDb, storeReading, getLatestReadings, getReadingHistory, getHouseStats };
