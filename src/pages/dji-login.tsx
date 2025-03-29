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
      
      // Log available methods
      addLog('Available DJI Bridge methods:');
      for (const method in window.djiBridge) {
        addLog(`- ${method}`);
      }
      
      // Try getting device info first
      try {
        const rcSN = await window.djiBridge.platformGetRemoteControllerSN();
        const aircraftSN = await window.djiBridge.platformGetAircraftSN();
        addLog(`Remote Controller SN: ${rcSN}`);
        addLog(`Aircraft SN: ${aircraftSN}`);
      } catch (err) {
        addLog('Failed to get device info');
      }

      const cloudParams = JSON.stringify({
        host: '89.17.150.216',
        port: 1883,
        username: 'droneuser',
        password: 'Jotunheimar',
        connectCallback: 'onMqttStatusChange',
        messageCallback: 'onTelemetryChange',
        clientId: `dji_pilot_${Date.now()}`,
        clean: true,
        protocol: 'tcp'
      });

      // Define the callback functions in the global scope before loading the module
      window.onMqttStatusChange = (status) => {
        addLog(`MQTT Status Change: ${status}`);
        try {
          const statusObj = JSON.parse(status);
          addLog(`Parsed MQTT Status: ${JSON.stringify(statusObj, null, 2)}`);
          
          // If connected successfully
          if (statusObj.code === 0 && statusObj.data?.connectState === 1) {
            addLog('MQTT Connected! Will attempt to publish test message...');
            
            // Try publishing with a simple topic
            setTimeout(async () => {
              try {
                const simplePublishParams = JSON.stringify({
                  topic: 'test',  // Use a very simple topic
                  message: 'Test from DJI Bridge',
                  qos: 0
                });
                
                addLog(`Attempting to publish with params: ${simplePublishParams}`);
                
                // Try different component names for publishing
                const componentNames = ['cloud.publish', 'cloud.send', 'thing.publish', 'thing.send'];
                
                for (const component of componentNames) {
                  try {
                    addLog(`Trying to publish using ${component}...`);
                    const publishResult = await window.djiBridge.platformLoadComponent(component, simplePublishParams);
                    addLog(`${component} result: ${publishResult}`);
                  } catch (err) {
                    addLog(`Failed with ${component}: ${err}`);
                  }
                  
                  // Wait between attempts
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              } catch (err) {
                addLog(`Error during publish attempts: ${err}`);
              }
            }, 2000); // Wait 2 seconds after connection before publishing
          }
        } catch (e) {
          addLog(`Error parsing MQTT status: ${e}`);
        }
      };

      window.onTelemetryChange = (message) => {
        addLog(`Received MQTT message: ${message}`);
        try {
          const parsedMessage = JSON.parse(message);
          addLog(`Parsed message: ${JSON.stringify(parsedMessage, null, 2)}`);
        } catch (e) {
          addLog(`Could not parse message as JSON: ${e}`);
        }
      };

      addLog('Loading Cloud Module...');
      const cloudLoadResultStr = await window.djiBridge.platformLoadComponent('cloud', cloudParams);
      addLog(`Raw Cloud Module Load Result: ${cloudLoadResultStr}`);
      
      try {
        const cloudLoadResult = JSON.parse(cloudLoadResultStr);
        addLog(`Parsed Cloud Module Load Result: ${JSON.stringify(cloudLoadResult, null, 2)}`);

        if (cloudLoadResult.code === 0) {
          // Try different component names for publishing
          const componentNames = ['cloud.publish', 'cloud.send', 'thing.publish', 'thing.send'];
          
          for (const component of componentNames) {
            const testPublishParams = JSON.stringify({
              topic: 'test',  // Try a simple topic first
              message: `Test from ${component}`,
              qos: 0
            });
            
            try {
              addLog(`Attempting to publish using ${component}...`);
              const publishResult = await window.djiBridge.platformLoadComponent(component, testPublishParams);
              addLog(`${component} result: ${publishResult}`);
            } catch (err) {
              addLog(`Failed with ${component}: ${err}`);
            }
            
            // Wait between attempts
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          // Try direct method if available
          if (typeof window.djiBridge.cloudPublish === 'function') {
            try {
              addLog('Attempting direct cloudPublish...');
              const directResult = await window.djiBridge.cloudPublish('test', 'Direct publish test');
              addLog(`Direct publish result: ${directResult}`);
            } catch (err) {
              addLog('Direct publish failed');
            }
          }
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
        
        // If connected, try an immediate publish
        if (status.code === 0 && status.data?.connectState === 1) {
          addLog('MQTT Connected, attempting immediate publish...');
          try {
            const testParams = JSON.stringify({
              topic: 'test',
              message: 'Connection confirmed test',
              qos: 0
            });
            const result = await window.djiBridge.platformLoadComponent('cloud.publish', testParams);
            addLog(`Immediate publish result: ${result}`);
          } catch (err) {
            addLog(`Immediate publish failed: ${err}`);
          }
        }
      } catch (err) {
        addLog(`Failed to parse status: ${err}`);
      }
    };

    window.onTelemetryChange = (dataStr: string) => {
      addLog(`Raw telemetry received: ${dataStr}`);
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