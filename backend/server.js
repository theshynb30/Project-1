import 'dotenv/config'
import mqtt from 'mqtt';
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { saveSensorData, getSensorData, getHourlyData, getDailyData, cleanOldData } from './database.js';
import os from 'os';

// Cấu hình IP và PORT
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // '0.0.0.0' = tất cả interface, hoặc IP cụ thể như '192.168.1.100'

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


const sub_topic = ['sensor/temp', 'sensor/humi', 'sensor/gas'];

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

// Lưu trữ giá trị sensor tạm thời để batch insert
let latestSensorData = { temp: null, humi: null, gas: null };
let lastSaveTime = Date.now();

mqttClient.on('message', (topic, message) => {
    const value = message.toString();
    
    io.emit('mqttData', {
        topic: topic,
        value: value,
        time: new Date().toLocaleTimeString()
    });
    console.log(`Received message on ${topic}: ${value}`);
    
    // Lưu vào biến tạm
    if (topic === 'sensor/temp') {
        latestSensorData.temp = parseFloat(value);
    } else if (topic === 'sensor/humi') {
        latestSensorData.humi = parseFloat(value);
    } else if (topic === 'sensor/gas') {
        latestSensorData.gas = parseInt(value);
    }
    
    // Lưu vào database mỗi 10 giây
    const now = Date.now();
    if (now - lastSaveTime >= 10000) {
        if (latestSensorData.temp !== null || latestSensorData.humi !== null || latestSensorData.gas !== null) {
            saveSensorData(
                latestSensorData.temp,
                latestSensorData.humi,
                latestSensorData.gas
            );
            lastSaveTime = now;
        }
    }
})

// API endpoints để lấy dữ liệu lịch sử
app.get('/api/sensor/history', (req, res) => {
    const hours = parseInt(req.query.hours) || 24;
    const data = getSensorData(hours);
    res.json(data);
});

app.get('/api/sensor/hourly', (req, res) => {
    const hours = parseInt(req.query.hours) || 24;
    const data = getHourlyData(hours);
    res.json(data);
});

app.get('/api/sensor/daily', (req, res) => {
    const data = getDailyData();
    res.json(data);
});

// Dọn dẹp dữ liệu cũ mỗi ngày
setInterval(() => {
    cleanOldData();
}, 24 * 60 * 60 * 1000); // 24 giờ

// Thay vì io.on('publish', ...), hãy dùng:
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.listen(PORT, HOST, () => {
    const interfaces = os.networkInterfaces();
    let ipAddress = 'localhost';
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ipAddress = iface.address;
                break;
            }
        }
    }
    
    console.log("Server is running on:");
    console.log(`  Host: ${HOST}:${PORT}`);
    console.log(`  Local: http://localhost:${PORT}`);
    console.log(`  Network: http://${ipAddress}:${PORT}`);
});