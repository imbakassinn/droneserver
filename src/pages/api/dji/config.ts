import { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Ensure this is a secure endpoint that requires authentication
  // You should add your authentication check here
  
  try {
    // Validate server base URL
    const serverBaseUrl = process.env.DJI_SERVER_BASE_URL;
    if (!serverBaseUrl) {
      throw new Error('Server base URL is not configured');
    }

    // Ensure the URL is properly formatted
    const formattedBaseUrl = serverBaseUrl.startsWith('http://') || serverBaseUrl.startsWith('https://')
      ? serverBaseUrl
      : `https://${serverBaseUrl}`;

    // Generate a valid UUID for workspace ID if not provided in env
    const workspaceId = process.env.DJI_WORKSPACE_ID || uuidv4();

    // Format MQTT host with protocol and port
    const mqttHost = 'mqtt://89.17.150.216:1883';  // Your remote MQTT server

    const config = {
      appId: process.env.DJI_APP_ID,
      appKey: process.env.DJI_APP_KEY,
      license: process.env.DJI_LICENSE,
      mqttHost: mqttHost,
      mqttUsername: 'droneuser',
      mqttPassword: 'Jotunheimar',
      serverBaseUrl: formattedBaseUrl,
      websocketUrl: process.env.DJI_WEBSOCKET_URL,
      platformName: process.env.DJI_PLATFORM_NAME || 'DJI Platform',
      // These values might be dynamic based on the user session
      sessionToken: 'generated-or-fetched-session-token',
      workspaceId: workspaceId,
      workspaceName: process.env.DJI_WORKSPACE_NAME || 'Default Workspace',
      workspaceDesc: process.env.DJI_WORKSPACE_DESC || 'Default Workspace Description'
    };

    res.status(200).json(config);
  } catch (error: any) {
    console.error('DJI config error:', error);
    res.status(500).json({ error: error.message || 'Failed to load DJI configuration' });
  }
} 