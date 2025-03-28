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
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const { login } = useAuth();
  const isDjiPilot = true; // Temporarily force this to true

  // Helper function to add debug logs
  const addLog = (message: string) => {
    setDebugLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

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

      // API Module Setup
      addLog('Loading API Module...');
      const apiParams = JSON.stringify({ 
        host: djiConfig.serverBaseUrl, 
        token: djiConfig.sessionToken 
      });
      const apiLoadResultStr = await window.djiBridge.platformLoadComponent('api', apiParams);
      const apiLoadResult = JSON.parse(apiLoadResultStr);
      addLog(`API Load Result: ${JSON.stringify(apiLoadResult)}`);

      // MQTT Setup
      addLog('Setting up MQTT connection...');
      addLog(`MQTT Host: ${djiConfig.mqttHost}`);
      addLog(`MQTT Username: ${djiConfig.mqttUsername}`);
      
      const cloudParams = JSON.stringify({
        host: djiConfig.mqttHost,
        username: djiConfig.mqttUsername,
        password: djiConfig.mqttPassword,
        connectCallback: 'onMqttStatusChange',
        messageCallback: 'onTelemetryChange',
        clientId: `dji_pilot_${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        keepalive: 60,
        timeout: 30
      });

      // Test message to the exact topic you're monitoring
      const testPublishParams = JSON.stringify({
        topic: 'thing/product/1581F5BKB23C900P018N/osd',
        message: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          message: 'Test message from DJI Pilot'
        }),
        qos: 0
      });
      
      addLog('Loading Cloud Module...');
      const cloudLoadResultStr = await window.djiBridge.platformLoadComponent('cloud', cloudParams);
      addLog(`Raw Cloud Module Load Result: ${cloudLoadResultStr}`);
      
      try {
        const cloudLoadResult = JSON.parse(cloudLoadResultStr);
        addLog(`Parsed Cloud Module Load Result: ${JSON.stringify(cloudLoadResult, null, 2)}`);

        if (cloudLoadResult.code === 0) {
          addLog('Cloud Module loaded successfully, attempting to publish test message...');
          
          // Try publishing test message
          const publishResult = await window.djiBridge.platformLoadComponent('cloud.publish', testPublishParams);
          addLog(`Test publish result: ${publishResult}`);
          
          // Subscribe to the exact topic
          const subscribeParams = JSON.stringify({
            topic: 'thing/product/1581F5BKB23C900P018N/osd',
            qos: 0
          });
          
          const subResult = await window.djiBridge.platformLoadComponent('cloud.subscribe', subscribeParams);
          addLog(`Subscription result: ${subResult}`);
          
          // Try publishing another message after subscription
          const postSubPublishParams = JSON.stringify({
            topic: 'thing/product/1581F5BKB23C900P018N/osd',
            message: JSON.stringify({
              test: true,
              timestamp: new Date().toISOString(),
              message: 'Post-subscription test message'
            }),
            qos: 0
          });
          
          const postSubPublishResult = await window.djiBridge.platformLoadComponent('cloud.publish', postSubPublishParams);
          addLog(`Post-subscription publish result: ${postSubPublishResult}`);
        } else {
          const errorMsg = `Failed to load Cloud Module: ${cloudLoadResult.message || 'Unknown error'} (Code: ${cloudLoadResult.code})`;
          addLog(`ERROR: ${errorMsg}`);
          setError(errorMsg);
        }
      } catch (parseErr: any) {
        addLog(`Failed to parse Cloud Module result: ${parseErr?.message || 'Unknown parse error'}`);
      }

      // Set Workspace Info
      addLog('Setting Workspace ID...');
      const wsIdResult = await window.djiBridge.platformSetWorkspaceId(djiConfig.workspaceId);
      addLog(`Workspace ID Result: ${JSON.stringify(wsIdResult)}`);

      addLog('Setting Platform Info...');
      const platformInfoResult = await window.djiBridge.platformSetInformation(
        djiConfig.platformName,
        djiConfig.workspaceName,
        djiConfig.workspaceDesc
      );
      addLog(`Platform Info Result: ${JSON.stringify(platformInfoResult)}`);

      setIsPilotLoggedIn(true);
      addLog('DJI Setup completed successfully');

    } catch (err: any) {
      const errorMsg = `Cloud Module Setup Error: ${err.message || 'Unknown error'} (${JSON.stringify(err)})`;
      addLog(`ERROR: ${errorMsg}`);
      setError(errorMsg);
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
      addLog(`Raw MQTT Status Update: ${statusStr}`);
      try {
        const status = JSON.parse(statusStr);
        addLog(`Parsed MQTT Status: ${JSON.stringify(status, null, 2)}`);
        
        if (status.code === 0) {
          if (status.data?.connectState === 1) {
            addLog('MQTT Connected Successfully! Will try to publish test message...');
            
            // Try publishing a test message on successful connection
            const testPublishParams = JSON.stringify({
              topic: 'thing/test',
              message: 'Test message after connection',
              qos: 0
            });
            
            try {
              const pubResult = await window.djiBridge.platformLoadComponent('cloud.publish', testPublishParams);
              addLog(`Test publish after connect result: ${pubResult}`);
            } catch (err: any) {
              addLog(`Publish error after connect: ${err.message || 'Unknown error'}`);
            }
          } else if (status.data?.connectState === 0) {
            addLog('MQTT Disconnected');
            setError('MQTT Disconnected');
          }
        } else {
          const errorMsg = `MQTT Error: ${status.message || 'Unknown error'} (Code: ${status.code})`;
          addLog(`ERROR: ${errorMsg}`);
          setError(errorMsg);
        }
      } catch (err: any) {
        const errorMsg = `Failed to parse MQTT status: ${err.message || 'Unknown error'}`;
        addLog(`ERROR: ${errorMsg}`);
        setError(errorMsg);
      }
    };

    window.onTelemetryChange = (dataStr: string) => {
      addLog(`Received raw telemetry message: ${dataStr}`);
      try {
        const data = JSON.parse(dataStr);
        addLog(`Parsed telemetry message: ${JSON.stringify(data, null, 2)}`);
        setTelemetryData(data);
      } catch (err: any) {
        addLog(`Failed to parse telemetry: ${err.message || 'Unknown parse error'}`);
      }
    };

    return () => {
        delete window.onMqttStatusChange;
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