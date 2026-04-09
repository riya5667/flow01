volatile int flow_frequency; // Measures flow sensor pulses
float l_minute;              // Calculated Liters per minute
unsigned char flowsensor = 2;// Flow Sensor input pin (Pin 2 is standard for interrupts on Uno)

unsigned long currentTime;
unsigned long cloopTime;

// Interrupt function called on every pulse
void flow()
{
   flow_frequency++;
}

void setup()
{
   pinMode(flowsensor, INPUT);
   digitalWrite(flowsensor, HIGH); // Enable internal pull-up resistor
   
   Serial.begin(9600); // Standard Baud Rate matching our Node.js parser
   
   // Attach the interrupt to Pin 2, triggering on the rising edge of the pulse
   attachInterrupt(digitalPinToInterrupt(flowsensor), flow, RISING); 
   
   interrupts(); // Enable global interrupts
   
   currentTime = millis();
   cloopTime = currentTime;
}

void loop()
{
   currentTime = millis();
   
   // Calculate flow rate every 1000 milliseconds (1 Second)
   if(currentTime >= (cloopTime + 1000))
   {
      cloopTime = currentTime; // Update loop time
      
      // The YF-S201 Flow Sensor emits around 7.5 pulses per second for 1 L/min.
      // Therefore: Flow Rate (L/min) = Pulse Frequency (Hz) / 7.5
      l_minute = (flow_frequency / 7.5);
      
      // Output exactly what the Node.js serial parser expects -> "FLOW:X.XX\n"
      Serial.print("FLOW:");
      Serial.println(l_minute, 2); // Send as a float with 2 decimal places
      
      flow_frequency = 0; // Reset pulse counter for the next second
   }
}
