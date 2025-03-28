import * as mqtt from 'mqtt';

const client = mqtt.connect('mqtt://89.17.150.216:1883', {
  username: 'droneuser',
  password: 'Jotunheimar'
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

client.on('message', (topic, message) => {
  console.log('Received message:', topic, message.toString());
}); 