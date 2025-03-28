import Database from 'better-sqlite3';
import { compare } from 'bcrypt';
import path from 'path';
import { User } from '@/types/auth';

const db = new Database(path.resolve('telemetry.db'));

export function getUserByUsername(username: string): { user: User, hashedPassword: string } | null {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const user = stmt.get(username) as any;
  
  if (!user) return null;
  
  return {
    user: {
      id: user.id,
      username: user.username,
      workspaceId: user.workspace_id,
      workspaceName: user.workspace_name,
      role: user.role,
    },
    hashedPassword: user.password
  };
}

export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return compare(plainPassword, hashedPassword);
} 