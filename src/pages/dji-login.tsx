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
    onTelemetryUpdate?: (telemetry: any) => void;
    // Add other callbacks if needed
  }
}

// Helper function to generate UUID for bid and tid
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
      window.connectCallback = function(status: any) {
        addLog(`MQTT Connection Status: ${status}`);
        
        // Even if we get a false connection status, we'll try to work with what we have
        setTimeout(async function() {
          try {
            // First, let's check what components are available
            try {
              const componentList = await window.djiBridge.platformGetComponentList();
              addLog(`Available components: ${componentList}`);
            } catch (err) {
              addLog(`Error getting component list: ${err}`);
            }
            
            // Try to get the aircraft SN directly
            try {
              const aircraftSn = await window.djiBridge.platformGetAircraftSN();
              addLog(`Aircraft SN: ${aircraftSn}`);
            } catch (err) {
              addLog(`Error getting aircraft SN: ${err}`);
            }
            
            // Try to get the remote controller SN
            try {
              const rcSn = await window.djiBridge.platformGetRemoteControllerSN();
              addLog(`Remote Controller SN: ${rcSn}`);
            } catch (err) {
              addLog(`Error getting RC SN: ${err}`);
            }
            
            // Try to get the device type
            try {
              const deviceType = await window.djiBridge.platformGetDeviceType();
              addLog(`Device Type: ${deviceType}`);
            } catch (err) {
              addLog(`Error getting device type: ${err}`);
            }
            
            // Try to get the firmware version
            try {
              const firmwareVersion = await window.djiBridge.platformGetFirmwareVersion();
              addLog(`Firmware Version: ${firmwareVersion}`);
            } catch (err) {
              addLog(`Error getting firmware version: ${err}`);
            }
            
            // Try to get the app version
            try {
              const appVersion = await window.djiBridge.platformGetAppVersion();
              addLog(`App Version: ${appVersion}`);
            } catch (err) {
              addLog(`Error getting app version: ${err}`);
            }
            
            // Try to get the SDK version
            try {
              const sdkVersion = await window.djiBridge.platformGetSDKVersion();
              addLog(`SDK Version: ${sdkVersion}`);
            } catch (err) {
              addLog(`Error getting SDK version: ${err}`);
            }
            
            // Try to get the current location
            try {
              const location = await window.djiBridge.platformGetCurrentLocation();
              addLog(`Current Location: ${location}`);
            } catch (err) {
              addLog(`Error getting current location: ${err}`);
            }
            
            // Try to get the flight status
            try {
              const flightStatus = await window.djiBridge.platformGetFlightStatus();
              addLog(`Flight Status: ${flightStatus}`);
            } catch (err) {
              addLog(`Error getting flight status: ${err}`);
            }
            
            // Try to get the battery level
            try {
              const batteryLevel = await window.djiBridge.platformGetBatteryLevel();
              addLog(`Battery Level: ${batteryLevel}`);
            } catch (err) {
              addLog(`Error getting battery level: ${err}`);
            }
            
            // Try to get the signal strength
            try {
              const signalStrength = await window.djiBridge.platformGetSignalStrength();
              addLog(`Signal Strength: ${signalStrength}`);
            } catch (err) {
              addLog(`Error getting signal strength: ${err}`);
            }
            
            // Try to get the GPS signal level
            try {
              const gpsSignal = await window.djiBridge.platformGetGPSSignalLevel();
              addLog(`GPS Signal Level: ${gpsSignal}`);
            } catch (err) {
              addLog(`Error getting GPS signal level: ${err}`);
            }
            
            // Try to get the home location
            try {
              const homeLocation = await window.djiBridge.platformGetHomeLocation();
              addLog(`Home Location: ${homeLocation}`);
            } catch (err) {
              addLog(`Error getting home location: ${err}`);
            }
            
            // Try to get the aircraft attitude
            try {
              const attitude = await window.djiBridge.platformGetAircraftAttitude();
              addLog(`Aircraft Attitude: ${attitude}`);
            } catch (err) {
              addLog(`Error getting aircraft attitude: ${err}`);
            }
            
            // Try to get the aircraft velocity
            try {
              const velocity = await window.djiBridge.platformGetAircraftVelocity();
              addLog(`Aircraft Velocity: ${velocity}`);
            } catch (err) {
              addLog(`Error getting aircraft velocity: ${err}`);
            }
            
            // Try to get the aircraft altitude
            try {
              const altitude = await window.djiBridge.platformGetAircraftAltitude();
              addLog(`Aircraft Altitude: ${altitude}`);
            } catch (err) {
              addLog(`Error getting aircraft altitude: ${err}`);
            }
            
            // Try to get the aircraft heading
            try {
              const heading = await window.djiBridge.platformGetAircraftHeading();
              addLog(`Aircraft Heading: ${heading}`);
            } catch (err) {
              addLog(`Error getting aircraft heading: ${err}`);
            }
            
          } catch (err) {
            addLog(`Error in device info gathering: ${err}`);
          }
        }, 2000);
      };

      // Define the message callback to handle all message types
      window.onTelemetryChange = function(message: any) {
        try {
          // Try to parse the message
          let parsedMessage;
          try {
            parsedMessage = JSON.parse(message);
          } catch (e) {
            // If not JSON, use as is
            parsedMessage = message;
          }
          
          // Check if it's a topology update (which we've already seen)
          if (typeof parsedMessage === 'object' && 
              parsedMessage.method === "update_topo") {
            // Just log a brief message for topology updates
            addLog(`Received topology update from ${parsedMessage.data?.sub_devices?.[0]?.sn || 'unknown'}`);
          } else {
            // Log other messages in full
            addLog(`Received MQTT message: ${JSON.stringify(parsedMessage, null, 2)}`);
          }
        } catch (e) {
          addLog(`Error in message callback: ${e}`);
        }
      };

      // Try a simpler MQTT connection approach
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

      // Try loading the thing module
      try {
        const thingLoadResultStr = await window.djiBridge.platformLoadComponent('thing', cloudParams);
        addLog(`Thing Module Load Result: ${thingLoadResultStr}`);
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

      // Try to get telemetry directly from the DJI Bridge
      setTimeout(async () => {
        try {
          // Try to register for telemetry updates
          try {
            const telemetryRegisterResult = await window.djiBridge.platformRegisterTelemetryCallback('onTelemetryUpdate');
            addLog(`Telemetry register result: ${telemetryRegisterResult}`);
          } catch (err) {
            addLog(`Error registering telemetry callback: ${err}`);
          }
          
          // Define the telemetry callback
          window.onTelemetryUpdate = function(telemetry: any) {
            addLog(`Received telemetry update: ${telemetry}`);
          };
          
          // Try to start telemetry updates
          try {
            const telemetryStartResult = await window.djiBridge.platformStartTelemetryUpdates();
            addLog(`Telemetry start result: ${telemetryStartResult}`);
          } catch (err) {
            addLog(`Error starting telemetry updates: ${err}`);
          }
          
        } catch (err) {
          addLog(`Error setting up direct telemetry: ${err}`);
        }
      }, 4000);

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