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

const addColumnIfMissing = (tableName, columnName, definition) => {
  db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`, (err) => {
    if (err && !String(err.message || '').toLowerCase().includes('duplicate column')) {
      console.error(`[Database] Failed to add ${columnName} to ${tableName}:`, err.message);
    }
  });
};

const initDb = (done = () => {}) => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS flow_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        house_id TEXT NOT NULL,
        flow1 REAL DEFAULT 0,
        flow2 REAL DEFAULT 0,
        flow_rate REAL NOT NULL,
        pressure REAL NOT NULL,
        tds REAL DEFAULT 0,
        vibration INTEGER DEFAULT 0,
        humidity REAL DEFAULT 0,
        distance_cm REAL DEFAULT 0,
        water_level REAL DEFAULT 0,
        ultrasonic INTEGER DEFAULT 0,
        leak INTEGER DEFAULT 0,
        theft INTEGER DEFAULT 0,
        buzzer INTEGER DEFAULT 0,
        water_health TEXT DEFAULT 'Unknown',
        status TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS current_status (
        house_id TEXT PRIMARY KEY,
        flow1 REAL DEFAULT 0,
        flow2 REAL DEFAULT 0,
        flow_rate REAL NOT NULL,
        pressure REAL NOT NULL,
        tds REAL DEFAULT 0,
        vibration INTEGER DEFAULT 0,
        humidity REAL DEFAULT 0,
        distance_cm REAL DEFAULT 0,
        water_level REAL DEFAULT 0,
        ultrasonic INTEGER DEFAULT 0,
        leak INTEGER DEFAULT 0,
        theft INTEGER DEFAULT 0,
        buzzer INTEGER DEFAULT 0,
        water_health TEXT DEFAULT 'Unknown',
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

    db.run(`
      CREATE TABLE IF NOT EXISTS sensor_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        house_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT DEFAULT 'critical',
        timestamp TEXT NOT NULL
      )
    `);

    /* 
    // Wipe out the old dummy data so the demo starts totally fresh!
    db.run(`DELETE FROM flow_data`);
    db.run(`DELETE FROM current_status`);
    db.run(`DELETE FROM house_stats`);
    */

    addColumnIfMissing('flow_data', 'tds', 'REAL DEFAULT 0');
    addColumnIfMissing('flow_data', 'water_health', "TEXT DEFAULT 'Unknown'");
    addColumnIfMissing('flow_data', 'flow1', 'REAL DEFAULT 0');
    addColumnIfMissing('flow_data', 'flow2', 'REAL DEFAULT 0');
    addColumnIfMissing('flow_data', 'vibration', 'INTEGER DEFAULT 0');
    addColumnIfMissing('flow_data', 'humidity', 'REAL DEFAULT 0');
    addColumnIfMissing('flow_data', 'soil', 'REAL DEFAULT 0');
    addColumnIfMissing('flow_data', 'distance_cm', 'REAL DEFAULT 0');
    addColumnIfMissing('flow_data', 'water_level', 'REAL DEFAULT 0');
    addColumnIfMissing('flow_data', 'ultrasonic', 'INTEGER DEFAULT 0');
    addColumnIfMissing('flow_data', 'leak', 'INTEGER DEFAULT 0');
    addColumnIfMissing('flow_data', 'theft', 'INTEGER DEFAULT 0');
    addColumnIfMissing('flow_data', 'buzzer', 'INTEGER DEFAULT 0');
    addColumnIfMissing('current_status', 'tds', 'REAL DEFAULT 0');
    addColumnIfMissing('current_status', 'water_health', "TEXT DEFAULT 'Unknown'");
    addColumnIfMissing('current_status', 'flow1', 'REAL DEFAULT 0');
    addColumnIfMissing('current_status', 'flow2', 'REAL DEFAULT 0');
    addColumnIfMissing('current_status', 'vibration', 'INTEGER DEFAULT 0');
    addColumnIfMissing('current_status', 'humidity', 'REAL DEFAULT 0');
    addColumnIfMissing('current_status', 'soil', 'REAL DEFAULT 0');
    addColumnIfMissing('current_status', 'distance_cm', 'REAL DEFAULT 0');
    addColumnIfMissing('current_status', 'water_level', 'REAL DEFAULT 0');
    addColumnIfMissing('current_status', 'ultrasonic', 'INTEGER DEFAULT 0');
    addColumnIfMissing('current_status', 'leak', 'INTEGER DEFAULT 0');
    addColumnIfMissing('current_status', 'theft', 'INTEGER DEFAULT 0');
    addColumnIfMissing('current_status', 'buzzer', 'INTEGER DEFAULT 0');

    db.run('PRAGMA user_version', (err) => {
      if (err) {
        console.error('[Database] Schema initialization did not finish cleanly:', err.message);
      }
      done(err);
    });
  });
};

const storeReading = (reading) => {
  const {
    house_id,
    flow1 = 0,
    flow2 = 0,
    flow_rate,
    pressure,
    tds = 0,
    vibration = 0,
    humidity = 0,
    soil = 0,
    distance_cm = 0,
    water_level = 0,
    ultrasonic = 0,
    leak = 0,
    theft = 0,
    buzzer = 0,
    water_health = 'Unknown',
    status,
    timestamp,
  } = reading;

  // Dual-Write: Stream historical telemetry securely to Aiven ClickHouse
  insertSensorData(reading);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    db.run(
      `INSERT INTO flow_data (house_id, flow1, flow2, flow_rate, pressure, tds, vibration, humidity, soil, distance_cm, water_level, ultrasonic, leak, theft, buzzer, water_health, status, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [house_id, flow1, flow2, flow_rate, pressure, tds, vibration, humidity, soil, distance_cm, water_level, ultrasonic, leak, theft, buzzer, water_health, status, timestamp],
    );

    db.run(
      `INSERT OR REPLACE INTO current_status (house_id, flow1, flow2, flow_rate, pressure, tds, vibration, humidity, soil, distance_cm, water_level, ultrasonic, leak, theft, buzzer, water_health, status, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [house_id, flow1, flow2, flow_rate, pressure, tds, vibration, humidity, soil, distance_cm, water_level, ultrasonic, leak, theft, buzzer, water_health, status, timestamp],
    );

    if (Array.isArray(reading.alert_reasons) && reading.alert_reasons.length > 0) {
      reading.alert_reasons.forEach((message) => {
        db.run(
          `INSERT INTO sensor_alerts (house_id, type, message, severity, timestamp) VALUES (?, ?, ?, ?, ?)`,
          [house_id, status || 'Sensor Alert', message, 'critical', timestamp],
        );
      });
    }

    const isFault = (status !== 'Normal' && status !== 'No Flow') ? 1 : 0;
    db.run(
      `INSERT INTO house_stats (house_id, cumulative_flow_liters, fault_count) 
       VALUES (?, ?, ?) 
       ON CONFLICT(house_id) DO UPDATE SET 
       cumulative_flow_liters = cumulative_flow_liters + excluded.cumulative_flow_liters,
       fault_count = fault_count + excluded.fault_count`,
      [house_id, flow_rate, isFault]
    );

    db.run('COMMIT', (err) => {
      if (err) {
        console.error('[Database] Transaction commit failed:', err.message);
        db.run('ROLLBACK');
      }
    });
  });
};

const getLatestReadings = (cb) => {
  db.all(
    `SELECT house_id, flow1, flow2, flow_rate, pressure, tds, vibration, humidity, soil, distance_cm, water_level, ultrasonic, leak, theft, buzzer, water_health, status, last_updated AS timestamp FROM current_status`,
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
      , flow1, flow2, vibration, humidity, soil, distance_cm, water_level, ultrasonic, leak, theft, buzzer, tds, water_health
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

const getRecentAlerts = ({ limit = 30 } = {}, cb) => {
  db.all(
    `
      SELECT id, house_id, type, message, severity, timestamp
      FROM sensor_alerts
      ORDER BY datetime(timestamp) DESC, id DESC
      LIMIT ?
    `,
    [limit],
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

const storeSensorAlert = (alert, cb = () => {}) => {
  const timestamp = alert.timestamp || new Date().toISOString();
  db.run(
    `INSERT INTO sensor_alerts (house_id, type, message, severity, timestamp) VALUES (?, ?, ?, ?, ?)`,
    [
      alert.house_id,
      alert.type || 'Sensor Alert',
      alert.message || 'Sensor anomaly detected.',
      alert.severity || 'critical',
      timestamp,
    ],
    function onInsert(err) {
      if (err) {
        console.error('[Database] Failed to store sensor alert:', err.message);
        cb(err);
        return;
      }

      cb(null, {
        id: this.lastID,
        house_id: alert.house_id,
        type: alert.type || 'Sensor Alert',
        message: alert.message || 'Sensor anomaly detected.',
        severity: alert.severity || 'critical',
        timestamp,
      });
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

module.exports = { initDb, storeReading, getLatestReadings, getReadingHistory, getHouseStats, getRecentAlerts, storeSensorAlert };
