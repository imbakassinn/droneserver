import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Database from 'better-sqlite3';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the path for your database file
const dbPath = path.resolve(__dirname, '..', 'telemetry.db');

// Initialize the database connection
const db = new Database(dbPath, { verbose: console.log });

console.log(`SQLite database initialized at ${dbPath}`); 