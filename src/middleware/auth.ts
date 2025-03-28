import { NextApiRequest, NextApiResponse } from 'next';
import { verify, JwtPayload } from 'jsonwebtoken';

export function authMiddleware(handler: Function) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = verify(token, process.env.JWT_SECRET!) as JwtPayload;
      req.user = decoded;
      
      return handler(req, res);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
} 