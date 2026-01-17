#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>

// ================== CẤU HÌNH WIFI & MQTT ==================
const char *ssid = "Hi Ma Ri";
const char *pass = "vanlahimari";

const char *mqtt_server = "445b05884ac848a8a362ee7d69401698.s1.eu.hivemq.cloud";
const int port = 8883;
const char *mqtt_user = "Admin1_iot";
const char *mqtt_pass = "Admin1_iot";

// ================== KHAI BÁO CHÂN ==================
#define DHTPIN 4
#define DHTTYPE DHT11
#define MQ2_PIN 15
#define LED_PIN 26 // Cần khai báo chân để không báo lỗi
#define FAN_PIN 32 // Cần khai báo chân để không báo lỗi

// ================== KHỞI TẠO ĐỐI TƯỢNG ==================
DHT dht(DHTPIN, DHTTYPE);
WiFiClientSecure espClient;
PubSubClient client(espClient);

// Hàm kết nối lại MQTT
void reconnect()
{
  while (!client.connected())
  {
    Serial.print("Attempting MQTT SSL connection...");
    String clientId = "ESP32Client-" + String(random(0xffff), HEX);

    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass))
    {
      Serial.println("connected");
      client.subscribe("device/led");
      client.subscribe("device/fan"); // Đăng ký thêm fan
    }
    else
    {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// Hàm nhận dữ liệu từ MQTT
void callback(char *topic, byte *payload, unsigned int length)
{
  String message = "";
  for (int i = 0; i < length; i++)
  {
    message += (char)payload[i];
  }

  Serial.printf("MQTT Message [%s]: %s\n", topic, message.c_str());

  if (String(topic) == "device/led")
  {
    digitalWrite(LED_PIN, (message == "ON") ? HIGH : LOW);
  }

  if (String(topic) == "device/fan")
  {
    digitalWrite(FAN_PIN, (message == "ON") ? HIGH : LOW);
  }
}

void setup()
{
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);

  dht.begin();

  // Kết nối WiFi
  WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // Cấu hình SSL và MQTT
  espClient.setInsecure(); // QUAN TRỌNG: Để bỏ qua xác thực chứng chỉ cổng 8883
  client.setServer(mqtt_server, port);
  client.setCallback(callback);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
}

void loop()
{
  if (!client.connected())
  {
    reconnect();
  }
  client.loop(); // Giữ kết nối và xử lý callback

  static unsigned long lastMsg = 0;
  unsigned long now = millis();

  // Gửi dữ liệu mỗi 2 giây (không dùng delay(2000) để tránh treo MQTT)
  if (now - lastMsg > 2000)
  {
    lastMsg = now;

    float h = dht.readHumidity();
    float t = dht.readTemperature();
    int mq2_value = analogRead(MQ2_PIN);

    if (!isnan(h) && !isnan(t))
    {
      Serial.printf("T: %.1f, H: %.1f, Gas: %d\n", t, h, mq2_value);
      client.publish("sensor/temp", String(t).c_str());
      client.publish("sensor/humi", String(h).c_str());
      client.publish("sensor/gas", String(mq2_value).c_str());
    }

    if (mq2_value > 2000)
    {
      Serial.println("⚠️ Phát hiện khí gas / khói!");
    }
  }
}