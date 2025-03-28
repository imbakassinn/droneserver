/** @type {import('next').NextConfig} */
export default {
  env: {
    DJI_APP_ID: process.env.DJI_APP_ID,
    DJI_APP_KEY: process.env.DJI_APP_KEY,
    DJI_LICENSE: process.env.DJI_LICENSE,
    DJI_MQTT_HOST: process.env.DJI_MQTT_HOST,
    DJI_MQTT_USERNAME: process.env.DJI_MQTT_USERNAME,
    DJI_MQTT_PASSWORD: process.env.DJI_MQTT_PASSWORD,
    DJI_SERVER_BASE_URL: process.env.DJI_SERVER_BASE_URL,
    DJI_WEBSOCKET_URL: process.env.DJI_WEBSOCKET_URL,
    DJI_PLATFORM_NAME: process.env.DJI_PLATFORM_NAME,
  },
} 