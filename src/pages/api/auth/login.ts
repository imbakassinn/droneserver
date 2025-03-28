import { NextApiRequest, NextApiResponse } from 'next';
import { sign } from 'jsonwebtoken';
import { getUserByUsername, verifyPassword } from '@/lib/user-db';
import { AuthResponse } from '@/types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'Leyndo';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const userRecord = getUserByUsername(username);
    if (!userRecord) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { user, hashedPassword } = userRecord;
    const isValidPassword = await verifyPassword(password, hashedPassword);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        workspaceId: user.workspaceId
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    const response: AuthResponse = {
      user,
      token
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 