import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Ensure this is a secure endpoint that requires authentication
  // You should add your authentication check here
  
  try {
    const config = {
      appId: process.env.DJI_APP_ID,
      appKey: process.env.DJI_APP_KEY,
      license: process.env.DJI_LICENSE,
      mqttHost: process.env.DJI_MQTT_HOST,
      mqttUsername: process.env.DJI_MQTT_USERNAME,
      mqttPassword: process.env.DJI_MQTT_PASSWORD,
      serverBaseUrl: process.env.DJI_SERVER_BASE_URL,
      websocketUrl: process.env.DJI_WEBSOCKET_URL,
      platformName: process.env.DJI_PLATFORM_NAME,
      // These values might be dynamic based on the user session
      sessionToken: 'generated-or-fetched-session-token',
      workspaceId: 'user-specific-workspace-id',
      workspaceName: 'User Workspace',
      workspaceDesc: 'User Workspace Description'
    };

    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load DJI configuration' });
  }
} 