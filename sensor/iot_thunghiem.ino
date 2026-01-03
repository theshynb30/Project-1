#define BLYNK_PRINT Serial
#define BLYNK_TEMPLATE_ID "TMPL6_Aq4FLSa"
#define BLYNK_TEMPLATE_NAME "Khanh"
#define BLYNK_AUTH_TOKEN "vO7fNbA1uh9mD1P3uNXo447GRgXLVLLh"

#include <WiFi.h>
#include <BlynkSimpleEsp32.h>
#include <DHT.h>
#include <PubSubClient.h> // Thêm thư viện MQTT

// ===== WIFI & MQTT =====
char ssid[] = "3 AE Sieu Nhan";
char pass[] = "bat4gmadung";
const char *mqtt_server = "broker.hivemq.com"; // Địa chỉ Broker

// ===== PIN & CONFIG =====
#define DHTPIN 4
#define DHTTYPE DHT11
#define MQ2_PIN 15
#define BUZZER_PIN 14
#define SERVO_PIN 18
#define LED_PIN 26
#define FAN_PIN 32

#define SERVO_CHANNEL 0
#define SERVO_FREQ 50
#define SERVO_RES 16

// ===== OBJECTS =====
DHT dht(DHTPIN, DHTTYPE);
BlynkTimer timer;
WiFiClient espClient;
PubSubClient client(espClient);

// ===== MQTT CALLBACK (NHẬN LỆNH TỪ WEB/APP KHÁC) =====
void callback(char *topic, byte *payload, unsigned int length)
{
  String message = "";
  for (int i = 0; i < length; i++)
  {
    message += (char)payload[i];
  }

  Serial.print("MQTT Message [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(message);

  // Điều khiển LED qua MQTT
  if (String(topic) == "device/led")
  {
    if (message == "ON")
    {
      digitalWrite(LED_PIN, HIGH);
      Blynk.virtualWrite(V5, 1); // Đồng bộ trạng thái lên Blynk
    }
    else
    {
      digitalWrite(LED_PIN, LOW);
      Blynk.virtualWrite(V5, 0);
    }
  }

  // Điều khiển QUẠT qua MQTT
  if (String(topic) == "device/fan")
  {
    if (message == "ON")
    {
      digitalWrite(FAN_PIN, HIGH);
      Blynk.virtualWrite(V6, 1);
    }
    else
    {
      digitalWrite(FAN_PIN, LOW);
      Blynk.virtualWrite(V6, 0);
    }
  }
}

// ===== KẾT NỐI LẠI MQTT =====
void reconnect()
{
  while (!client.connected())
  {
    Serial.print("Connecting MQTT...");
    // Tạo ID ngẫu nhiên để tránh trùng lặp
    String clientId = "ESP32Client-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str()))
    {
      Serial.println("Connected!");
      // Đăng ký nhận lệnh từ các topic này
      client.subscribe("device/led");
      client.subscribe("device/fan");
    }
    else
    {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      delay(5000);
    }
  }
}

uint32_t angleToDuty(int angle)
{
  return map(angle, 0, 180, 1638, 8192);
}

// ===== BLYNK WRITE =====
BLYNK_WRITE(V5)
{
  int val = param.asInt();
  digitalWrite(LED_PIN, val);
  client.publish("status/led", val ? "ON" : "OFF"); // Phản hồi lại MQTT
}

BLYNK_WRITE(V6)
{
  int val = param.asInt();
  digitalWrite(FAN_PIN, val);
  client.publish("status/fan", val ? "ON" : "OFF");
}

// ===== ĐỌC CẢM BIẾN VÀ PUBLISH MQTT =====
void readSensor()
{
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  int gas = digitalRead(MQ2_PIN);

  if (isnan(t) || isnan(h))
    return;

  // Gửi lên Blynk
  Blynk.virtualWrite(V1, t);
  Blynk.virtualWrite(V2, h);

  // Gửi lên MQTT (Publish)
  client.publish("sensor/temp", String(t).c_str());
  client.publish("sensor/humi", String(h).c_str());
  client.publish("sensor/gas", (gas == HIGH) ? "DANGER" : "SAFE");

  // Logic báo động (giữ nguyên của bạn)
  if (t > 40 || gas == HIGH)
  {
    digitalWrite(BUZZER_PIN, HIGH);
    ledcWrite(SERVO_CHANNEL, angleToDuty(90));
  }
  else
  {
    digitalWrite(BUZZER_PIN, LOW);
    ledcWrite(SERVO_CHANNEL, angleToDuty(0));
  }
}

void setup()
{
  Serial.begin(115200);
  pinMode(MQ2_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);

  ledcSetup(SERVO_CHANNEL, SERVO_FREQ, SERVO_RES);
  ledcAttachPin(SERVO_PIN, SERVO_CHANNEL);

  dht.begin();
  Blynk.begin(BLYNK_AUTH_TOKEN, ssid, pass);

  // Cấu hình MQTT
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);

  timer.setInterval(2000L, readSensor);
}

void loop()
{
  if (!client.connected())
  {
    reconnect();
  }
  client.loop(); // Duy trì kết nối MQTT
  Blynk.run();
  timer.run();
}