// lib/db.ts
import Database from 'better-sqlite3';
import path from 'path';

// Define the path for your database file
const dbPath = path.resolve('telemetry.db'); // Creates telemetry.db in your project root

// Initialize the database connection
const db = new Database(dbPath, { verbose: console.log }); // verbose logs SQL queries to console, useful for debugging

console.log(`SQLite database initialized at ${dbPath}`);

// Create the telemetry table if it doesn't exist
const createTableStmt = db.prepare(`
    CREATE TABLE IF NOT EXISTS telemetry (
        timestamp INTEGER PRIMARY KEY,   -- Using drone's timestamp (ms) as primary key
        latitude REAL,
        longitude REAL,
        altitude REAL,                 -- Absolute height (Ellipsoid)
        elevation REAL,                -- Relative to takeoff point
        attitude_pitch REAL,
        attitude_roll REAL,
        attitude_head REAL,
        horizontal_speed REAL,
        vertical_speed REAL,
        received_at INTEGER             -- Server timestamp when data was received/inserted
        -- Add other fields as needed based on DJI docs
    );
`);
createTableStmt.run();

console.log("Checked/Created 'telemetry' table.");

// Ensure graceful shutdown
process.on('exit', () => db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));

export default db; // Export the database connection instance