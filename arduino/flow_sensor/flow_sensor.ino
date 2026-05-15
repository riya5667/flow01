// ========================================
// SMART WATER MONITORING SYSTEM
// OPTIMIZED FINAL VERSION
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
const byte tdsPin = A2;
const byte soilMoisturePin = A3;

const byte trigPin = 8;
const byte echoPin = 9;

const byte buzzerPin = 10;

// ---------- TANK SETTINGS ----------
const float tankEmptyDistanceCm = 25.0;
const float tankFullDistanceCm = 4.0;

// ---------- VARIABLES ----------
float lastValidDistance = 0.0;

unsigned long currentTime = 0;
unsigned long previousTime = 0;


// ========================================
// FLOW INTERRUPTS
// ========================================
void flow1Pulse()
{
  flow1Frequency++;
}

void flow2Pulse()
{
  flow2Frequency++;
}


// ========================================
// ULTRASONIC FUNCTION
// ========================================
float readDistanceCm()
{
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);

  digitalWrite(trigPin, LOW);

  long duration = pulseIn(
    echoPin,
    HIGH,
    30000
  );

  if (duration == 0)
  {
    return lastValidDistance;
  }

  float distance =
    duration * 0.0343 / 2.0;

  // Filter invalid values
  if (distance <= 0 || distance > 400)
  {
    return lastValidDistance;
  }

  return distance;
}


// ========================================
// WATER LEVEL FUNCTION
// ========================================
int calculateLevelPercent(float distanceCm)
{
  float level =
    (
      (tankEmptyDistanceCm - distanceCm)
      /
      (tankEmptyDistanceCm - tankFullDistanceCm)
    ) * 100.0;

  return constrain((int)level, 0, 100);
}


// ========================================
// SETUP
// ========================================
void setup()
{
  Serial.begin(9600);

  pinMode(flowSensor1Pin, INPUT_PULLUP);
  pinMode(flowSensor2Pin, INPUT_PULLUP);

  pinMode(vibrationPin, INPUT_PULLUP);

  pinMode(humidityPin, INPUT);
  pinMode(tdsPin, INPUT);
  pinMode(soilMoisturePin, INPUT);

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  pinMode(buzzerPin, OUTPUT);

  attachInterrupt(
    digitalPinToInterrupt(flowSensor1Pin),
    flow1Pulse,
    RISING
  );

  attachInterrupt(
    digitalPinToInterrupt(flowSensor2Pin),
    flow2Pulse,
    RISING
  );

  Serial.println("SMART WATER SYSTEM STARTED");
}


// ========================================
// LOOP
// ========================================
void loop()
{
  currentTime = millis();

  if (currentTime - previousTime >= 1000)
  {
    previousTime = currentTime;

    // ========================================
    // FLOW SENSORS
    // ========================================

    noInterrupts();

    unsigned int flow1Pulses = flow1Frequency;
    unsigned int flow2Pulses = flow2Frequency;

    flow1Frequency = 0;
    flow2Frequency = 0;

    interrupts();

    flow1Rate = flow1Pulses / 7.5;
    flow2Rate = flow2Pulses / 7.5;

    if (flow1Rate < 0.1)
    {
      flow1Rate = 0;
    }

    if (flow2Rate < 0.1)
    {
      flow2Rate = 0;
    }


    // ========================================
    // VIBRATION SENSOR
    // ========================================

    int vibrationDetected = 0;

    if (digitalRead(vibrationPin) == LOW)
    {
      vibrationDetected = 1;
    }


    // ========================================
    // HUMIDITY SENSOR
    // ========================================

    long humidityTotal = 0;

    for (int i = 0; i < 10; i++)
    {
      humidityTotal += analogRead(humidityPin);
      delay(2);
    }

    int humidityRaw =
      humidityTotal / 10;

    int humidityPercent = map(
      humidityRaw,
      1023,
      0,
      0,
      100
    );

    humidityPercent = constrain(
      humidityPercent,
      0,
      100
    );


    // ========================================
    // SOIL MOISTURE SENSOR
    // ========================================

    long soilTotal = 0;

    for (int i = 0; i < 15; i++)
    {
      soilTotal += analogRead(soilMoisturePin);
      delay(5);
    }

    int soilRaw =
      soilTotal / 15;

    // Calibrate according to your sensor
    int soilMoisturePercent = map(
      soilRaw,
      900,
      350,
      0,
      100
    );

    soilMoisturePercent = constrain(
      soilMoisturePercent,
      0,
      100
    );


    // ========================================
    // TDS SENSOR
    // ========================================

    long tdsTotal = 0;

    for (int i = 0; i < 30; i++)
    {
      tdsTotal += analogRead(tdsPin);
      delay(10);
    }

    float tdsRaw =
      tdsTotal / 30.0;

    float voltage =
      tdsRaw * 5.0 / 1024.0;

    float tdsPpm =
    (
      133.42 * voltage * voltage * voltage
      - 255.86 * voltage * voltage
      + 857.39 * voltage
    ) * 0.5;

    if (tdsPpm < 0)
    {
      tdsPpm = 0;
    }


    // ========================================
    // ULTRASONIC SENSOR
    // ========================================

    float distanceCm =
      readDistanceCm();

    lastValidDistance =
      distanceCm;

    int waterLevelPercent =
      calculateLevelPercent(distanceCm);


    // ========================================
    // FLOW DIFFERENCE
    // ========================================

    float flowMismatch =
      abs(flow1Rate - flow2Rate);


    // ========================================
    // LEAK DETECTION
    // ========================================

    int leakDetected = 0;

    if (
      soilMoisturePercent >= 55 ||
      flowMismatch >= 0.5
    )
    {
      leakDetected = 1;
    }


    // ========================================
    // THEFT DETECTION
    // ========================================

    int theftDetected = 0;

    bool halfMeterDrop =
      (
        flow1Rate > 0.1 &&
        flow2Rate <= flow1Rate * 0.5
      )
      ||
      (
        flow2Rate > 0.1 &&
        flow1Rate <= flow2Rate * 0.5
      );

    if (halfMeterDrop)
    {
      theftDetected = 1;
    }


    // ========================================
    // BUZZER
    // ========================================

    int buzzerState = 0;

    if (
      vibrationDetected == 1 ||
      leakDetected == 1 ||
      theftDetected == 1
    )
    {
      buzzerState = 1;

      tone(buzzerPin, 2000);
    }
    else
    {
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

    Serial.print(",TDS:");
    Serial.print((int)tdsPpm);

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