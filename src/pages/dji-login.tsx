// pages/dji-login.tsx
import React, { useState, useEffect } from 'react';
import styles from '../styles/DjiLogin.module.css'; // Create this CSS module for styling
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';

// Define the structure for the config fetched from your backend
interface DjiConfig {
  appId: string;
  appKey: string;
  license: string;
  mqttHost: string;
  mqttUsername?: string; // Optional if anonymous
  mqttPassword?: string; // Optional if anonymous
  serverBaseUrl: string; // Base URL for your Next.js app for API module
  websocketUrl: string;  // WSS URL for WS module (if needed)
  sessionToken: string; // Your app's session token for Pilot 2 to use
  workspaceId: string;
  platformName: string;
  workspaceName: string;
  workspaceDesc: string;
}

// Define global callback functions (if needed by JSBridge)
declare global {
  interface Window {
    djiBridge?: any; // Declare djiBridge presence
    onMqttStatusChange?: (status: string) => void;
    onWsStatusChange?: (status: string) => void;
    onTelemetryChange?: (dataStr: string) => void;
    // Add other callbacks if needed
  }
}


const DjiLoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPilotLoggedIn, setIsPilotLoggedIn] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // For testing, we'll skip the DJI Pilot check
  const isDjiPilot = true; // Temporarily force this to true

  // Helper function to add debug logs
  const addLog = (message: string) => {
    setDebugLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  // --- JSBridge Communication Logic ---
  const setupDjiConnection = async (djiConfig: DjiConfig) => {
    setError(null);
    addLog('Attempting DJI JSBridge setup...');

    if (typeof window === 'undefined' || !window.djiBridge) {
      addLog('ERROR: DJI Bridge is not available!');
      setError('This page must be opened within DJI Pilot 2.');
      setIsLoading(false);
      return;
    }

    try {
      // License verification
      addLog('Verifying DJI License...');
      const licenseResultStr = await window.djiBridge.platformVerifyLicense(
        djiConfig.appId,
        djiConfig.appKey,
        djiConfig.license
      );
      const licenseResult = JSON.parse(licenseResultStr);
      addLog(`License verification result: ${JSON.stringify(licenseResult)}`);

      // MQTT Setup
      addLog('Setting up MQTT connection...');
      addLog(`MQTT Host: ${djiConfig.mqttHost}`);
      addLog(`MQTT Username present: ${!!djiConfig.mqttUsername}`);
      
      const thingParam = JSON.stringify({
        host: djiConfig.mqttHost,
        username: djiConfig.mqttUsername || '',
        password: djiConfig.mqttPassword || '',
        connectCallback: 'onMqttStatusChange',
        clientId: `web_${Date.now()}`
      });

      const thingLoadResultStr = await window.djiBridge.platformLoadComponent('thing', thingParam);
      const thingLoadResult = JSON.parse(thingLoadResultStr);
      addLog(`MQTT Load Result: ${JSON.stringify(thingLoadResult)}`);

      // --- Load Core Modules ---

      // 2. Load API module [cite: 3927]
      console.log('Loading API Module...');
      const apiParam = JSON.stringify({ host: djiConfig.serverBaseUrl, token: djiConfig.sessionToken });
      const apiLoadResultStr = await window.djiBridge.platformLoadComponent('api', apiParam);
      const apiLoadResult = JSON.parse(apiLoadResultStr);
      if (apiLoadResult.code !== 0) console.warn(`API Module Load Warning: ${apiLoadResult.message}`);
      else console.log('API Module Loaded.');

      // 3. Load WS module (Optional - if needed) [cite: 3929]
      // console.log('Loading WS Module...');
      // const wsParam = JSON.stringify({ host: djiConfig.websocketUrl, token: djiConfig.sessionToken, connectCallback: 'onWsStatusChange' });
      // const wsLoadResultStr = await window.djiBridge.platformLoadComponent('ws', wsParam);
      // Check result...

      // 4. Load Cloud (Thing) Module for MQTT [cite: 567, 3916]
      console.log('Loading MQTT (Thing) Module...');
      const thingParam = JSON.stringify({
        host: djiConfig.mqttHost,
        username: djiConfig.mqttUsername,
        password: djiConfig.mqttPassword,
        connectCallback: 'onMqttStatusChange'
      });
      const thingLoadResultStr = await window.djiBridge.platformLoadComponent('thing', thingParam);
      const thingLoadResult = JSON.parse(thingLoadResultStr);
      // Note: MQTT connects asynchronously. Use the callback 'onMqttStatusChange' to confirm connection.
       if (thingLoadResult.code !== 0) console.warn(`MQTT Module Load Warning: ${thingLoadResult.message}`);
       else console.log('MQTT Module Load Initiated.');

      // --- Set Platform Info ---

      // 5. Set Workspace ID [cite: 573, 3865]
      console.log('Setting Workspace ID...');
      const wsIdResultStr = await window.djiBridge.platformSetWorkspaceId(djiConfig.workspaceId);
      // Check result...

      // 6. Set Platform Info [cite: 573, 3869]
      console.log('Setting Platform Info...');
      const infoResultStr = await window.djiBridge.platformSetInformation(
        djiConfig.platformName,
        djiConfig.workspaceName,
        djiConfig.workspaceDesc
      );
      // Check result...
      console.log('DJI Platform Info Set.');

      // --- Load Optional Feature Modules (Load as needed) --- [cite: 3907]
      // console.log('Loading Mission Module...');
      // await window.djiBridge.platformLoadComponent('mission', JSON.stringify({})); //
      // console.log('Loading Media Module...');
      // await window.djiBridge.platformLoadComponent('media', JSON.stringify({ autoUploadPhoto: true })); //

      console.log('DJI JSBridge setup appears complete.');
      setIsPilotLoggedIn(true); // Update UI

    } catch (err: any) {
      const errorMsg = `DJI Setup Error: ${err.message || 'Unknown error'}`;
      addLog(`ERROR: ${errorMsg}`);
      setError(errorMsg);
      // Consider unloading components on error if appropriate
      // if (window.djiBridge) {
      //    await window.djiBridge.platformUnloadComponent('thing');
      //    await window.djiBridge.platformUnloadComponent('api');
      // }
    } finally {
      setIsLoading(false);
    }
  };

  // --- User Authentication Logic ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Authenticate user with backend
      const authResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const { user, token } = await authResponse.json();
      
      // Store auth data
      login(user, token);

      // Get DJI config and set up connection
      try {
        const configResponse = await fetch('/api/dji/config');
        if (!configResponse.ok) {
          throw new Error('Failed to fetch DJI configuration');
        }
        const djiConfig = await configResponse.json();
        await setupDjiConnection(djiConfig);
      } catch (err: any) {
        console.error("DJI Setup Error:", err);
        setError(`DJI Setup Error: ${err.message}`);
      }

      // Remove the router.push('/') to stay on the current page
      setIsPilotLoggedIn(true);

    } catch (err: any) {
      console.error("Login/Setup Error:", err);
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

   // --- Setup Global Callbacks ---
   useEffect(() => {
    window.onMqttStatusChange = async (statusStr: string) => {
      addLog(`MQTT Status Update: ${statusStr}`);
      try {
        const status = JSON.parse(statusStr);
        
        if (status.code === 0) {
          if (status.data?.connectState === 1) {
            addLog('MQTT Connected Successfully!');
            
            // Subscribe to telemetry
            const subParam = JSON.stringify({
              topic: 'thing/status/#',
              qos: 0
            });
            
            try {
              const subResult = await window.djiBridge.thingSubscribe(subParam);
              addLog(`Subscription result: ${subResult}`);
            } catch (err: any) {
              addLog(`Subscription error: ${err.message}`);
            }
          } else if (status.data?.connectState === 0) {
            addLog('MQTT Disconnected');
          }
        } else {
          const errorMsg = `MQTT Error: ${status.message || 'Unknown error'} (Code: ${status.code})`;
          addLog(`ERROR: ${errorMsg}`);
          setError(errorMsg);
        }
      } catch (err: any) {
        addLog(`Failed to parse MQTT status: ${err.message}`);
      }
    };
    window.onWsStatusChange = (statusStr: string) => {
        console.log("WebSocket Status Callback:", statusStr);
        // Handle WS connection changes if needed
    };

    // Add telemetry callback
    window.onTelemetryChange = (dataStr: string) => {
      addLog(`Received telemetry: ${dataStr.substring(0, 100)}...`);
      try {
        const data = JSON.parse(dataStr);
        setTelemetryData(data);
      } catch (err: any) {
        addLog(`Failed to parse telemetry: ${err.message}`);
      }
    };

    // Cleanup
    return () => {
        delete window.onMqttStatusChange;
        delete window.onWsStatusChange;
        delete window.onTelemetryChange;
    }
  }, []);

  // --- Render Logic ---
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>DJI Controller Data</h1>
      
      {!isDjiPilot && (
        <div className={styles.error}>
          This page must be opened within DJI Pilot 2.
        </div>
      )}

      {isDjiPilot && (
        <>
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              className={styles.button}
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Debug Logs Section */}
          <div className={styles.debugContainer}>
            <h3>Debug Logs</h3>
            <div className={styles.logs}>
              {debugLogs.map((log, index) => (
                <div key={index} className={styles.logEntry}>
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Telemetry Data Section */}
          {isPilotLoggedIn && telemetryData && (
            <div className={styles.telemetryContainer}>
              <h2>Live Telemetry Data</h2>
              <pre className={styles.telemetryData}>
                {JSON.stringify(telemetryData, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}

      <div className={styles.info}>
        Default credentials: admin / admin123
      </div>
    </div>
  );
};

export default DjiLoginPage;

// Remember to create styles/DjiLogin.module.css for basic styling