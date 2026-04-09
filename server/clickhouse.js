const { createClient } = require('@clickhouse/client');
require('dotenv').config();

let client = null;

try {
  if (process.env.AIVEN_CLICKHOUSE_HOST) {
    client = createClient({
      url: process.env.AIVEN_CLICKHOUSE_HOST,
      username: process.env.AIVEN_CLICKHOUSE_USER,
      password: process.env.AIVEN_CLICKHOUSE_PASSWORD,
      database: process.env.AIVEN_CLICKHOUSE_DATABASE,
    });
  }
} catch (e) {
  console.warn("ClickHouse client not found or configured. Did you run npm install @clickhouse/client?");
}

const initAivenDb = async () => {
  if (!client) return;
  try {
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS aiven_flow_data (
          id UUID DEFAULT generateUUIDv4(),
          house_id String,
          flow_rate Float32,
          pressure Float32,
          status String,
          timestamp DateTime
        ) ENGINE = MergeTree()
        ORDER BY (house_id, timestamp)
      `,
    });
    console.log('Connected to Aiven ClickHouse database & schema verified.');
    
    // Wipe old demo data to match the SQLite demo freshness?
    // We can run TRUNCATE TABLE if this is purely a demo.
    await client.exec({ query: `TRUNCATE TABLE aiven_flow_data` });
  } catch (err) {
    console.error('Error connecting to Aiven ClickHouse:', err.message);
  }
};

const insertSensorData = async (reading) => {
  if (!client) return;
  const { house_id, flow_rate, pressure, status, timestamp } = reading;
  
  try {
    // ClickHouse DateTime expects 'YYYY-MM-DD HH:MM:SS'
    let formattedTimestamp = timestamp;
    if (formattedTimestamp.includes('T')) {
      formattedTimestamp = formattedTimestamp.replace('T', ' ').substring(0, 19);
    } else if (new Date(timestamp).toString() !== 'Invalid Date') {
      formattedTimestamp = new Date(timestamp).toISOString().replace('T', ' ').substring(0, 19);
    } else {
      formattedTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    }
    
    await client.insert({
      table: 'aiven_flow_data',
      values: [
        {
          house_id,
          flow_rate,
          pressure,
          status,
          timestamp: formattedTimestamp,
        }
      ],
      format: 'JSONEachRow'
    });
  } catch (err) {
    console.error('Aiven Insert Error:', err.message);
  }
};

const getAivenHistory = async ({ houseId, limit = 24 }) => {
  if (!client) return [];
  try {
    const resultSet = await client.query({
      query: `
        SELECT house_id, flow_rate, pressure, status, toString(timestamp) as timestamp 
        FROM aiven_flow_data
        WHERE house_id = {houseId: String}
        ORDER BY timestamp DESC
        LIMIT {limit: UInt32}
      `,
      query_params: { houseId, limit },
      format: 'JSONEachRow'
    });
    
    return await resultSet.json();
  } catch (err) {
    console.error('Aiven Query Error:', err.message);
    return [];
  }
};

module.exports = { initAivenDb, insertSensorData, getAivenHistory };
