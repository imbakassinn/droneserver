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
    connectCallback?: (status: boolean) => void;
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
      
      
      // Try getting device info first
      try {
        const rcSN = await window.djiBridge.platformGetRemoteControllerSN();
        const aircraftSN = await window.djiBridge.platformGetAircraftSN();
        addLog(`Remote Controller SN: ${rcSN}`);
        addLog(`Aircraft SN: ${aircraftSN}`);
      } catch (err) {
        addLog('Failed to get device info');
      }

      // Define the callback function in the global scope BEFORE loading the module
      window.connectCallback = function(status) {
        addLog(`MQTT Connection Status: ${status}`);
        
        try {
          // Parse the status if it's a string
          let statusObj = status;
          let isConnected = false;
          
          if (typeof status === 'boolean') {
            // If status is a boolean, use it directly
            isConnected = status;
          } else if (typeof status === 'string') {
            // If status is a string, check if it's 'true' or try to parse it as JSON
            if (status === 'true') {
              isConnected = true;
            } else {
              try {
                statusObj = JSON.parse(status);
                addLog(`Parsed status: ${JSON.stringify(statusObj, null, 2)}`);
                
                // Check if the parsed object indicates a successful connection
                isConnected = 
                  (statusObj && statusObj.code === 0) ||
                  (statusObj && statusObj.connected === true) ||
                  (statusObj && statusObj.data && statusObj.data.connectState === 1);
              } catch (e) {
                // If it's not valid JSON, assume disconnected
                addLog(`Error parsing status: ${e}`);
              }
            }
          } else if (typeof status === 'object' && status !== null) {
            // If status is already an object, check its properties
            isConnected = 
              (status.code === 0) ||
              (status.connected === true) ||
              (status.data && status.data.connectState === 1);
          }
          
          if (isConnected) {
            addLog('MQTT Connected! Will attempt to publish test message...');
            
            // Wait a moment before publishing
            setTimeout(async function() {
              try {
                // Get the device SN for topic construction
                const deviceSn = window.djiBridge.platformGetAircraftSN();
                addLog(`Device SN: ${deviceSn}`);
                
                // Get the remote controller SN as fallback
                const rcSn = window.djiBridge.platformGetRemoteControllerSN();
                addLog(`Remote Controller SN: ${rcSn}`);
                
                // Use the correct SN for topic construction
                const sn = deviceSn || rcSn || '4LFCLC7006N944'; // Use the SN from your logs as fallback
                
                // Try publishing to the topics we've seen in the logs
                const topics = [
                  `thing/product/${sn}/property`,
                  `thing/product/${sn}/state`,
                  `sys/product/${sn}/status`
                ];
                
                for (const topic of topics) {
                  const publishParams = JSON.stringify({
                    topic: topic,
                    message: JSON.stringify({
                      id: Date.now().toString(),
                      bid: generateUUID(),
                      tid: generateUUID(),
                      timestamp: Date.now(),
                      method: "custom_test",
                      data: {
                        test: true,
                        message: "Test from DJI Bridge",
                        timestamp: Date.now()
                      }
                    }),
                    qos: 0
                  });
                  
                  addLog(`Publishing to topic: ${topic}`);
                  addLog(`With params: ${publishParams}`);
                  
                  // Try different methods for publishing
                  const methods = ['thing.property.post', 'thing.publish', 'thing.post', 'thing.event.post'];
                  
                  for (const method of methods) {
                    try {
                      addLog(`Trying to publish using ${method}...`);
                      const publishResult = await window.djiBridge.platformLoadComponent(method, publishParams);
                      addLog(`${method} result: ${publishResult}`);
                    } catch (err) {
                      addLog(`Failed with ${method}: ${err}`);
                    }
                    
                    // Wait between attempts
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }
              } catch (err) {
                addLog(`Error during publish: ${err}`);
              }
            }, 2000);
          } else {
            addLog('MQTT Disconnected or connection failed');
            
            // Try reconnecting after a delay
            setTimeout(async () => {
              addLog('Attempting to reconnect MQTT...');
              try {
                const reconnectParams = JSON.stringify({
                  host: '89.17.150.216',
                  port: 1883,
                  username: 'droneuser',
                  password: 'Jotunheimar',
                  connectCallback: 'connectCallback',
                  messageCallback: 'onTelemetryChange',
                  clientId: `dji_pilot_${Date.now()}`, // Generate a new client ID
                  clean: true,
                  protocol: 'tcp'
                });
                
                addLog(`Reconnecting with params: ${reconnectParams}`);
                const reconnectResult = await window.djiBridge.platformLoadComponent('thing', reconnectParams);
                addLog(`Reconnect result: ${reconnectResult}`);
              } catch (err) {
                addLog(`Reconnect error: ${err}`);
              }
            }, 5000);
          }
        } catch (err) {
          addLog(`Error in connectCallback: ${err}`);
        }
      };

      // Define the message callback
      window.onTelemetryChange = function(message) {
        addLog(`Received MQTT message: ${message}`);
        try {
          const parsedMessage = JSON.parse(message);
          addLog(`Parsed message: ${JSON.stringify(parsedMessage, null, 2)}`);
        } catch (e) {
          addLog(`Could not parse message as JSON: ${e}`);
        }
      };

      // Helper function to generate UUID for bid and tid
      function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }

      // Set up the MQTT connection with the hardcoded parameters
      const cloudParams = JSON.stringify({
        host: '89.17.150.216',
        port: 1883,
        username: 'droneuser',
        password: 'Jotunheimar',
        connectCallback: 'connectCallback',
        messageCallback: 'onTelemetryChange',
        clientId: `dji_pilot_${Date.now()}`,
        clean: true,
        protocol: 'tcp'
      });

      addLog(`Loading Thing Module with params: ${cloudParams}`);

      // Try loading both 'thing' and 'cloud' modules
      try {
        const thingLoadResultStr = await window.djiBridge.platformLoadComponent('thing', cloudParams);
        addLog(`Thing Module Load Result: ${thingLoadResultStr}`);
        
        try {
          const thingLoadResult = JSON.parse(thingLoadResultStr);
          addLog(`Parsed Thing Load Result: ${JSON.stringify(thingLoadResult, null, 2)}`);
        } catch (e) {
          addLog(`Error parsing thing load result: ${e}`);
        }
      } catch (e) {
        addLog(`Error loading thing module: ${e}`);
        
        // Try cloud module if thing module fails
        try {
          addLog('Trying cloud module...');
          const cloudLoadResultStr = await window.djiBridge.platformLoadComponent('cloud', cloudParams);
          addLog(`Cloud Module Load Result: ${cloudLoadResultStr}`);
        } catch (e) {
          addLog(`Error loading cloud module: ${e}`);
        }
      }

      // Also try subscribing to the topics we've seen in the logs
      setTimeout(async () => {
        const topics = [
          'sys/product/+/status',
          'thing/product/+/state',
          'thing/product/+/property'
        ];
        
        for (const topic of topics) {
          try {
            addLog(`Subscribing to topic: ${topic}`);
            const subscribeParams = JSON.stringify({
              topic: topic,
              qos: 0
            });
            
            const subscribeResult = await window.djiBridge.platformLoadComponent('thing.subscribe', subscribeParams);
            addLog(`Subscribe result for ${topic}: ${subscribeResult}`);
          } catch (err) {
            addLog(`Subscribe error for ${topic}: ${err}`);
          }
          
          // Wait between subscribes
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }, 3000);

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