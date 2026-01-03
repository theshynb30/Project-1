import { useEffect } from "react";
import { useState } from "react";
import io from "socket.io-client";
const socket = io("http://localhost:3001");
const App = () => {
  const [status, setStatus] = useState("Đang kết nối...");

  useEffect(() => {
    socket.on('connect', () => {
      setStatus("Đã kết nối")
    });
    socket.on('disconnect', () => {
      setStatus("Đang kết nối ...")
    })
  }, [socket])

  return (
    <>
      <h1>MQTT Smart Home Dashboard</h1>
      <p>Trạng thái: <span id="mqtt-status" class={status === "Đã kết nối" ? "status-connected" : "status-connecting"}>{status}</span></p>

      <div class="card">
        <h3>Cảm biến</h3>
        <p>Nhiệt độ: <span id="temp" class="sensor-val">--</span> °C</p>
        <p>Độ ẩm: <span id="humi" class="sensor-val">--</span> %</p>
        <p>Gas: <span id="gas" class="sensor-val">--</span></p>
      </div>

      <div class="card">
        <h3>Điều khiển Đèn</h3>
        <button class="btn-on" onclick="publishMessage('device/led', 'ON')">BẬT</button>
        <button class="btn-off" onclick="publishMessage('device/led', 'OFF')">TẮT</button>
      </div>

      <div class="card">
        <h3>Điều khiển Quạt</h3>
        <button class="btn-on" onclick="publishMessage('device/fan', 'ON')">BẬT</button>
        <button class="btn-off" onclick="publishMessage('device/fan', 'OFF')">TẮT</button>
      </div>
    </>
  )
}
export default App;