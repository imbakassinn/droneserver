import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Database from 'better-sqlite3';
import { hash } from 'bcrypt';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = path.resolve(__dirname, '..', 'telemetry.db');
const db = new Database(dbPath);

async function initUsersTable() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      workspace_name TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'operator', 'viewer')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create initial admin user if none exists
  const adminPassword = await hash('admin123', 10);
  
  const insertAdmin = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password, workspace_id, workspace_name, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertAdmin.run(
    '1',
    'admin',
    adminPassword,
    'ws_001',
    'Main Workspace',
    'admin'
  );

  console.log('Users table initialized');
}

initUsersTable().catch(console.error); 