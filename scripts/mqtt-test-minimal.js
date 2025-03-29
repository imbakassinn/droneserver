import mqtt from 'mqtt';

// Create a client with identical settings to your terminal command
const client = mqtt.connect('mqtt://89.17.150.216:1883', {
  username: 'droneuser',
  password: 'Jotunheimar',
  clientId: `test_client_${Date.now()}`
});

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  
  // Use the exact same topic and message as your terminal command
  const topic = 'test/topic'; // Replace with your working topic
  const message = 'Hello from Node.js';
  
  console.log(`Publishing to ${topic}: ${message}`);
  client.publish(topic, message, { qos: 0 }, (err) => {
    if (err) {
      console.error('Publish error:', err);
    } else {
      console.log('Message published successfully');
      // Wait a moment before disconnecting
      setTimeout(() => {
        client.end();
        console.log('Disconnected');
      }, 1000);
    }
  });
});

client.on('error', (err) => {
  console.error('MQTT Error:', err);
});
