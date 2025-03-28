import { NextApiRequest } from 'next';
import { JwtPayload } from 'jsonwebtoken';

declare module 'next' {
  interface NextApiRequest {
    user?: JwtPayload | string;
  }
}

declare global {
  interface Window {
    djiBridge?: any;
    onMqttStatusChange?: (status: string) => void;
    onWsStatusChange?: (status: string) => void;
    onTelemetryChange?: (data: string) => void;
  }
} 