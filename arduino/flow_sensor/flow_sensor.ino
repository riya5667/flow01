// ========================================
// SMART WATER MONITORING SYSTEM
// ARDUINO UNO
// ========================================

// ---------- FLOW SENSOR 1 ----------
volatile unsigned int flow1Frequency = 0;

// ---------- FLOW SENSOR 2 ----------
volatile unsigned int flow2Frequency = 0;

// ---------- FLOW RATES ----------
float flow1Rate = 0.0;
float flow2Rate = 0.0;

// ---------- PINS ----------
const byte flowSensor1Pin = 2;
const byte flowSensor2Pin = 3;

const byte humidityPin = A0;

const byte trigPin = 8;
const byte echoPin = 9;

const byte buzzerPin = 10;

// ---------- TANK SETTINGS ----------
const float tankEmptyDistanceCm = 25.0;
const float tankFullDistanceCm = 4.0;

const int lowWaterLevelPercent = 20;

const int leakDropThresholdPercent = 5;

// ---------- TIMERS ----------
unsigned long currentTime = 0;
unsigned long cloopTime = 0;

unsigned long leakCheckStart = 0;

// ---------- WATER LEVEL ----------
float lastValidDistance = 0.0;

int previousWaterLevel = -1;


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
// ULTRASONIC DISTANCE
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

  return duration * 0.0343 / 2.0;
}


// ========================================
// LEVEL PERCENT
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

  // Flow sensors
  pinMode(flowSensor1Pin, INPUT_PULLUP);
  pinMode(flowSensor2Pin, INPUT_PULLUP);

  // Humidity
  pinMode(humidityPin, INPUT);

  // Ultrasonic
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // Buzzer
  pinMode(buzzerPin, OUTPUT);

  // Interrupts
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

  currentTime = millis();
  cloopTime = currentTime;

  leakCheckStart = currentTime;

  Serial.println("SMART WATER SYSTEM STARTED");
}


// ========================================
// LOOP
// ========================================
void loop()
{
  currentTime = millis();

  // Update every second
  if (currentTime - cloopTime >= 1000)
  {
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
    if (flow1Rate < 0.1)
    {
      flow1Rate = 0.0;
    }

    if (flow2Rate < 0.1)
    {
      flow2Rate = 0.0;
    }

    // ========================================
    // HUMIDITY FILTERING
    // ========================================

    long humidityTotal = 0;

    for (int i = 0; i < 10; i++)
    {
      humidityTotal += analogRead(humidityPin);
      delay(2);
    }

    int humidityRaw = humidityTotal / 10;

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
    // ULTRASONIC
    // ========================================

    float distanceCm = readDistanceCm();

    lastValidDistance = distanceCm;

    int waterLevelPercent =
      calculateLevelPercent(distanceCm);

    // ========================================
    // LEAK DETECTION
    // ========================================

    int leakDetected = 0;

    if (previousWaterLevel == -1)
    {
      previousWaterLevel = waterLevelPercent;
    }

    int levelDrop =
      previousWaterLevel - waterLevelPercent;

    if (
      levelDrop >= leakDropThresholdPercent &&
      flow1Rate > 0
    )
    {
      leakDetected = 1;
    }

    previousWaterLevel = waterLevelPercent;

    // ========================================
    // THEFT DETECTION
    // ========================================

    int theftDetected = 0;

    if (
      flow2Rate > 1.0 &&
      waterLevelPercent < lowWaterLevelPercent
    )
    {
      theftDetected = 1;
    }

    // ========================================
    // BUZZER
    // ========================================

    int buzzerState = 0;

    if (
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

    Serial.print(",HUMIDITY:");
    Serial.print(humidityPercent);

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