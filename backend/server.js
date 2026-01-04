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
    console.log(`Received message on ${topic}: ${message.toString()}`);
})

// Thay vì io.on('publish', ...), hãy dùng:
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Lắng nghe sự kiện 'publish' từ chính socket vừa kết nối
    socket.on('publish', (data) => {
        const { topic, message } = data; // React gửi object {topic, message}

        if (pub_topic.includes(topic)) {
            mqttClient.publish(topic, message, { qos: 1 }, (err) => {
                if (err) {
                    console.error("Publish error:", err);
                } else {
                    console.log(`Successfully published to ${topic}: ${message}`);
                }
            });
        } else {
            console.warn(`Topic ${topic} không nằm trong danh sách pub_topic`);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.listen(3001, () => {
    console.log("Server is running on http://localhost:3001");
})