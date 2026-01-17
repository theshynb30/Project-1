import { useEffect, useRef } from "react";
import { useState } from "react";
import io from "socket.io-client";
import './App.css';
import TemperatureChart from './components/TemperatureChart';
import MinuteTemperatureChart from './components/MinuteTemperatureChart';
import WeeklyTemperatureChart from './components/WeeklyTemperatureChart';

// Kết nối tới backend - tự động phát hiện IP từ window.location
const getBackendURL = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:3001`;
};

const socket = io(getBackendURL(), {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

const App = () => {
  const [temp, setTemp] = useState("--")
  const [humi, setHumi] = useState("--")
  const [gas, setGas] = useState("--")
  const [showTempCharts, setShowTempCharts] = useState(false);
  const [gasAlert, setGasAlert] = useState(false);
  const [showGasHistory, setShowGasHistory] = useState(false);
  const [gasAlertHistory, setGasAlertHistory] = useState([]);
  const [activeChartType, setActiveChartType] = useState('minute');
  const audioContextRef = useRef(null);
  const lastAlertTimeRef = useRef(0);

  // Shared handler so we can feed both real socket data and demo data
  const handleMqttData = (data) => {
    const { topic, value } = data;
    if (topic === 'sensor/temp') setTemp(value);
    else if (topic === 'sensor/humi') setHumi(value);
    else if (topic === 'sensor/gas') {
      const gasValue = parseFloat(value);
      setGas(value);
      if (gasValue > 400) {
        setGasAlert(true);
        const now = Date.now();
        // Chỉ thêm vào lịch sử và phát âm thanh nếu đã qua 20 giây từ lần trước
        if (now - lastAlertTimeRef.current > 20000) {
          lastAlertTimeRef.current = now;
          const timestamp = new Date().toLocaleString('vi-VN');
          setGasAlertHistory(prev => {
            const newHistory = [{ time: timestamp, value: gasValue }, ...prev];
            // Giới hạn chỉ lưu 20 cảnh báo gần nhất
            return newHistory.slice(0, 20);
          });
          playAlertSound();
        }
      } else {
        setGasAlert(false);
      }
    }
  };

  useEffect(() => {
    // Lắng nghe dữ liệu
    const onMqttData = (data) => {
      const { topic, value } = data;
      if (topic.startsWith('sensor/')) {
        handleMqttData(data);
      }
    };

    const onConnect = () => console.log('Socket connected');
    const onDisconnect = () => console.log('Socket disconnected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('mqttData', onMqttData);

    // HÀM CLEANUP:
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('mqttData', onMqttData);
    };
  }, []);

  const playAlertSound = () => {
    try {
      // Reuse audio context nếu đã có
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Tần số 800Hz
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing alert sound:', error);
    }
  };

  return (
    <div className="app">
      <header className="site-header">
        <h1>SMART HOME</h1>
      </header>

      <div className="main-container">
        {/* sensors row: to lên gấp đôi, căn lề trái */}
        <div className="sensors-left">
          <div
            className="sensor clickable"
            onClick={() => setShowTempCharts(!showTempCharts)}
            title="Xem biểu đồ nhiệt độ"
          >
            <div className="label">Nhiệt độ</div>
            <div className="value">{temp}{temp !== '--' ? '°C' : ''}</div>
          </div>

          <div className="sensor">
            <div className="label">Độ ẩm</div>
            <div className="value">{humi}{humi !== '--' ? '%' : ''}</div>
          </div>

          <div
            className={`sensor clickable ${gasAlert ? 'gas-danger' : ''}`}
            onClick={() => setShowGasHistory(!showGasHistory)}
            title="Xem lịch sử cảnh báo"
          >
            <div className="label">Gas</div>
            <div className="value">{gas}</div>
          </div>
        </div>

        {/* middle content: alerts, charts, history */}
        <div className="middle-panel">
          {gasAlert && (
            <div className="gas-alert-inline">
              <div className="alert-icon">⚠️</div>
              <div className="alert-body">
                <h2>Cảnh báo khí Gas!</h2>
                <p className="alert-message">
                  Phát hiện khí gas vượt ngưỡng an toàn (hiện tại: <strong>{gas}</strong> > 400)
                </p>
                <p className="alert-description">
                  Vui lòng kiểm tra nguồn khí và thông gió khu vực ngay lập tức!
                </p>
              </div>
              <button 
                className="alert-close-btn"
                onClick={() => setGasAlert(false)}
              >
                Tôi đã biết
              </button>
            </div>
          )}

          {showTempCharts && (
            <div className="charts-section">
              <div className="chart-tabs">
                <button
                  className={`chart-tab ${activeChartType === 'minute' ? 'active' : ''}`}
                  onClick={() => setActiveChartType('minute')}
                >
                  Theo phút
                </button>
                <button
                  className={`chart-tab ${activeChartType === 'hourly' ? 'active' : ''}`}
                  onClick={() => setActiveChartType('hourly')}
                >
                  Theo giờ
                </button>
                <button
                  className={`chart-tab ${activeChartType === 'weekly' ? 'active' : ''}`}
                  onClick={() => setActiveChartType('weekly')}
                >
                  Theo tuần
                </button>
              </div>
              
              {activeChartType === 'minute' && <MinuteTemperatureChart tempValue={temp} />}
              {activeChartType === 'hourly' && <TemperatureChart tempValue={temp} />}
              {activeChartType === 'weekly' && <WeeklyTemperatureChart tempValue={temp} />}
            </div>
          )}

          {showGasHistory && (
            <div className="history-section">
              {gasAlertHistory.length > 0 ? (
                <>
                  <h3>Lịch sử cảnh báo khí Gas</h3>
                  <div className="history-list">
                    {gasAlertHistory.map((alert, index) => (
                      <div key={index} className="history-item">
                        <div className="history-time">
                          <span className="alert-icon">⚠️</span>
                          {alert.time}
                        </div>
                        <div className="history-value">
                          Giá trị: <strong>{alert.value}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="no-history">
                  <p>Chưa có cảnh báo khí gas nào</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default App;