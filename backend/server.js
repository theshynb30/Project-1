import 'dotenv/config'
import mqtt from 'mqtt';
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


const sub_topic = ['sensor/temp', 'sensor/humi', 'sensor/gas', 'status/led', 'status/fan']
const pub_topic = ['device/led', 'device/fan']

const mqttClient = mqtt.connect(
    `mqtts://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`,
    {
        username: process.env.MQTT_USER,
        password: process.env.MQTT_PASS,
        rejectUnauthorized: false, // Bỏ qua lỗi chứng chỉ SSL
    }
);
mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    sub_topic.forEach(topic => {
        try {
            mqttClient.subscribe(topic);
            console.log("Subscribed to topic:", topic);
        } catch (error) {
            console.error('Lỗi khi subscribe chủ đề:', topic, error.message);
        }
    })

})
mqttClient.on('error', (err) => {
    console.error('Lỗi kết nối :', err.message);
});

mqttClient.on('message', (topic, message) => {
    io.emit('mqttData', {
        topic: topic,
        value: message.toString(),
        time: new Date().toLocaleTimeString()
    });
})

server.listen(3001, () => {
    console.log("Server is running on http://localhost:3001");
})