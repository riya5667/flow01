// ========================================
// SMART WATER MONITORING SYSTEM
// ARDUINO UNO
// ========================================

// ---------- FLOW SENSOR VARIABLES ----------
volatile unsigned int flow1Frequency = 0;
volatile unsigned int flow2Frequency = 0;

float flow1Rate = 0.0;
float flow2Rate = 0.0;

// ---------- PINS ----------
const byte flowSensor1Pin = 2;
const byte flowSensor2Pin = 3;

const byte vibrationPin = 4;

const byte humidityPin = A0;
const byte soilMoisturePin = A1;
const byte tdsPin = A2;

const byte trigPin = 8;
const byte echoPin = 9;

const byte buzzerPin = 10;

// ---------- TANK SETTINGS ----------
const float tankEmptyDistanceCm = 25.0;
const float tankFullDistanceCm = 4.0;

const int lowWaterLevelPercent = 20;
const int leakDropThresholdPercent = 5;
const float tdsTemperatureC = 25.0;
const int vibrationTriggerLevel = LOW;

// ---------- TIMERS ----------
unsigned long currentTime = 0;
unsigned long cloopTime = 0;

// ---------- WATER LEVEL ----------
float lastValidDistance = 0.0;

int previousWaterLevel = -1;

// ========================================
// FLOW SENSOR INTERRUPTS
// ========================================
void flow1Pulse() { flow1Frequency++; }

void flow2Pulse() { flow2Frequency++; }

// ========================================
// ULTRASONIC DISTANCE FUNCTION
// ========================================
float readDistanceCm() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);

  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000);

  // No reading
  if (duration == 0) {
    return lastValidDistance;
  }

  float distance = duration * 0.0343 / 2.0;

  return distance;
}

// ========================================
// WATER LEVEL CALCULATION
// ========================================
int calculateLevelPercent(float distanceCm) {
  float level = ((tankEmptyDistanceCm - distanceCm) /
                 (tankEmptyDistanceCm - tankFullDistanceCm)) *
                100.0;

  return constrain((int)level, 0, 100);
}

// ========================================
// SETUP
// ========================================
void setup() {
  Serial.begin(9600);

  // Flow sensors
  pinMode(flowSensor1Pin, INPUT_PULLUP);
  pinMode(flowSensor2Pin, INPUT_PULLUP);

  // Vibration sensor
  pinMode(vibrationPin, INPUT);

  // Humidity sensor
  pinMode(humidityPin, INPUT);

  // Soil moisture sensor
  pinMode(soilMoisturePin, INPUT);

  // TDS sensor
  pinMode(tdsPin, INPUT);

  // Ultrasonic
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // Buzzer
  pinMode(buzzerPin, OUTPUT);

  // Attach interrupts
  attachInterrupt(digitalPinToInterrupt(flowSensor1Pin), flow1Pulse, RISING);

  attachInterrupt(digitalPinToInterrupt(flowSensor2Pin), flow2Pulse, RISING);

  currentTime = millis();
  cloopTime = currentTime;

  Serial.println("SMART WATER SYSTEM STARTED");
}

// ========================================
// MAIN LOOP
// ========================================
void loop() {
  currentTime = millis();

  // Update every 1 second
  if (currentTime - cloopTime >= 1000) {
    cloopTime = currentTime;

    // ========================================
    // FLOW SENSOR READINGS
    // ========================================

    noInterrupts();

    unsigned int flow1Pulses = flow1Frequency;
    unsigned int flow2Pulses = flow2Frequency;

    flow1Frequency = 0;
    flow2Frequency = 0;

    interrupts();

    flow1Rate = flow1Pulses / 7.5;
    flow2Rate = flow2Pulses / 7.5;

    // Noise filtering
    if (flow1Rate < 0.1) {
      flow1Rate = 0.0;
    }

    if (flow2Rate < 0.1) {
      flow2Rate = 0.0;
    }

    // ========================================
    // VIBRATION SENSOR
    // ========================================

    int vibrationDetected = 0;

    // Sample several times because vibration sensors often pulse briefly.
    for (int i = 0; i < 20; i++) {
      if (digitalRead(vibrationPin) == vibrationTriggerLevel) {
        vibrationDetected = 1;
      }
      delay(1);
    }

    // ========================================
    // HUMIDITY SENSOR
    // ========================================

    long humidityTotal = 0;

    for (int i = 0; i < 10; i++) {
      humidityTotal += analogRead(humidityPin);
      delay(2);
    }

    int humidityRaw = humidityTotal / 10;

    int humidityPercent = map(humidityRaw, 1023, 0, 0, 100);

    humidityPercent = constrain(humidityPercent, 0, 100);

    // ========================================
    // SOIL MOISTURE SENSOR
    // ========================================

    long soilTotal = 0;

    for (int i = 0; i < 10; i++) {
      soilTotal += analogRead(soilMoisturePin);
      delay(2);
    }

    int soilRaw = soilTotal / 10;

    int soilMoisturePercent = map(soilRaw, 1023, 0, 0, 100);

    soilMoisturePercent = constrain(soilMoisturePercent, 0, 100);

    // ========================================
    // TDS SENSOR
    // ========================================

    long tdsTotal = 0;

    for (int i = 0; i < 10; i++) {
      tdsTotal += analogRead(tdsPin);
      delay(2);
    }

    int tdsRaw = tdsTotal / 10;

    float tdsVoltage = tdsRaw * (5.0 / 1024.0);
    float compensationCoefficient = 1.0 + 0.02 * (tdsTemperatureC - 25.0);
    float compensatedVoltage = tdsVoltage / compensationCoefficient;
    float tdsPpm =
      (133.42 * compensatedVoltage * compensatedVoltage * compensatedVoltage -
       255.86 * compensatedVoltage * compensatedVoltage +
       857.39 * compensatedVoltage) *
      0.5;

    tdsPpm = constrain(tdsPpm, 0.0, 2000.0);

    // ========================================
    // ULTRASONIC SENSOR
    // ========================================

    float distanceCm = readDistanceCm();

    lastValidDistance = distanceCm;

    int waterLevelPercent = calculateLevelPercent(distanceCm);

    // ========================================
    // LEAK & THEFT DETECTION (Soil Moisture + Flow Meter Comparison)
    // ========================================

    int leakDetected = 0;
    int theftDetected = 0;

    // Compare the reading and behavior of both flow meters
    float flowMismatch = 0.0;
    if (flow1Rate > flow2Rate) {
      flowMismatch = flow1Rate - flow2Rate;
    } else {
      flowMismatch = flow2Rate - flow1Rate;
    }

    bool halfMeterDrop =
      (flow1Rate > 0.1 && flow2Rate <= flow1Rate * 0.5) ||
      (flow2Rate > 0.1 && flow1Rate <= flow2Rate * 0.5);

    // If one meter reads half or less than the other, flag theft.
    if (halfMeterDrop) {
      theftDetected = 1;
    }
    // Wet soil means leakage near the pipe.
    else if (soilMoisturePercent >= 55) {
      leakDetected = 1;
    }
    // Dry soil plus abnormal flow drop/mismatch indicates possible theft.
    else if (soilMoisturePercent <= 20 && (flowMismatch >= 2.0 || (flow1Rate > 0.1 && flow2Rate <= flow1Rate * 0.65))) {
      theftDetected = 1;
    }
    // A smaller continuous discrepancy indicates leakage when moisture is present.
    else if (flowMismatch >= 0.3) {
      leakDetected = 1;
    }

    // ========================================
    // BUZZER CONTROL
    // ========================================

    int buzzerState = 0;

    if (vibrationDetected == 1 || leakDetected == 1 || theftDetected == 1) {
      buzzerState = 1;

      tone(buzzerPin, 2000);
    } else {
      noTone(buzzerPin);
    }

    // ========================================
    // SERIAL OUTPUT
    // ========================================

    Serial.print("FLOW1:");
    Serial.print(flow1Rate, 2);

    Serial.print(",FLOW2:");
    Serial.print(flow2Rate, 2);

    Serial.print(",VIBRATION:");
    Serial.print(vibrationDetected);

    Serial.print(",HUMIDITY:");
    Serial.print(humidityPercent);

    Serial.print(",SOIL:");
    Serial.print(soilMoisturePercent);

    Serial.print(",TDSRAW:");
    Serial.print(tdsRaw);

    Serial.print(",TDS:");
    Serial.print(tdsPpm, 0);

    Serial.print(",DISTANCE:");
    Serial.print(distanceCm, 2);

    Serial.print(",LEVEL:");
    Serial.print(waterLevelPercent);

    Serial.print(",LEAK:");
    Serial.print(leakDetected);

    Serial.print(",THEFT:");
    Serial.print(theftDetected);

    Serial.print(",BUZZER:");
    Serial.println(buzzerState);
  }
}
