import mqtt from 'mqtt';

const client = mqtt.connect('mqtt://89.17.150.216:1883', {
  username: 'droneuser',
  password: 'Jotunheimar',
  clientId: `mqtt_test_${Math.random().toString(16).slice(2, 8)}`,
  clean: true
});

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  client.subscribe('thing/product/1581F5BKB23C900P018N/osd', (err) => {
    if (err) {
      console.error('Subscription error:', err);
    } else {
      console.log('Subscribed to topic');
    }
  });
});

client.on('error', (error) => {
  console.error('MQTT Error:', error);
});

client.on('close', () => {
  console.log('Connection closed');
});

client.on('offline', () => {
  console.log('Client went offline');
});

client.on('reconnect', () => {
  console.log('Attempting to reconnect...');
});

client.on('message', (topic, message) => {
  console.log('Received message:', topic, message.toString());
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Closing MQTT connection...');
  client.end(true, () => {
    console.log('MQTT connection closed');
    process.exit(0);
  });
}); 