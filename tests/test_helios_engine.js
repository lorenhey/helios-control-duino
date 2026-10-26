/**
 * test_helios_engine.js
 * Suite de Pruebas Unitarias para HeliosEngine (Node.js)
 * HelioControlDuino v2.0.0
 */

const assert = require('assert');
const Helios = require('../js/helios-engine');

console.log('--- Iniciando Pruebas Unitarias de HelioControlDuino Engine ---');

// =========================================================================
// Test 1: Funciones Matemáticas y Diferencia Normalizada
// =========================================================================
function testMathUtils() {
  console.log('[1/8] Verificando funciones matemáticas y normalización...');
  assert.strictEqual(Helios.normalizedDifference(1000, 0, 1000), 100);
  assert.strictEqual(Helios.normalizedDifference(0, 1000, 1000), -100);
  assert.strictEqual(Helios.normalizedDifference(500, 500, 1000), 0);
  assert.strictEqual(Helios.normalizedDifference(1800, 600, 2400), 50);
  assert.strictEqual(Helios.normalizedDifference(10, 10, 0), 0); // División por cero segura

  assert.strictEqual(Helios.clamp(150, 10, 100), 100);
  assert.strictEqual(Helios.clamp(-5, 0, 90), 0);
  assert.strictEqual(Helios.clamp(45, 0, 90), 45);
  console.log('  -> OK: Matemáticas y normalización exactas.');
}

// =========================================================================
// Test 2: Validación de Fechas y Años Bisiestos
// =========================================================================
function testDateCalculations() {
  console.log('[2/8] Verificando validación astronómica de fechas y bisiestos...');
  const calc = Helios.SolarCalculator;

  assert.strictEqual(calc.leapYear(2024), true);
  assert.strictEqual(calc.leapYear(2026), false);
  assert.strictEqual(calc.leapYear(2000), true);
  assert.strictEqual(calc.leapYear(1900), false);

  assert.strictEqual(calc.validDateTime({ year: 2026, month: 2, day: 30, hour: 12, minute: 0, second: 0 }), false);
  assert.strictEqual(calc.validDateTime({ year: 2024, month: 2, day: 29, hour: 12, minute: 0, second: 0 }), true);
  assert.strictEqual(calc.validDateTime({ year: 2026, month: 2, day: 29, hour: 12, minute: 0, second: 0 }), false);
  assert.strictEqual(calc.validDateTime({ year: 1999, month: 1, day: 1, hour: 0, minute: 0, second: 0 }), false); // Año < 2000

  assert.strictEqual(calc.dayOfYear({ year: 2026, month: 1, day: 15, hour: 0, minute: 0, second: 0 }), 15);
  assert.strictEqual(calc.dayOfYear({ year: 2026, month: 3, day: 1, hour: 0, minute: 0, second: 0 }), 60); // 31 + 28 + 1
  assert.strictEqual(calc.dayOfYear({ year: 2024, month: 3, day: 1, hour: 0, minute: 0, second: 0 }), 61); // Bisiesto
  console.log('  -> OK: Calendario y fechas validadas correctamente.');
}

// =========================================================================
// Test 3: SolarCalculator (Comparativa exacta con test_main.cpp de C++)
// =========================================================================
function testSolarEphemeris() {
  console.log('[3/8] Verificando algoritmo solar Meeus/SPA vs La Plata (C++ reference)...');
  const calc = Helios.SolarCalculator;
  const laPlata = { latitudeDegrees: -34.9214, longitudeDegrees: -57.9544, utcOffsetMinutes: -180 };

  // Caso inválido idéntico al test de C++
  const invalid = { year: 2026, month: 2, day: 30, hour: 12, minute: 0, second: 0 };
  assert.strictEqual(calc.calculate(invalid, laPlata).valid, false);

  // Mediodía en verano en La Plata (15 de enero de 2026, 12:00)
  const noon = { year: 2026, month: 1, day: 15, hour: 12, minute: 0, second: 0 };
  const sunNoon = calc.calculate(noon, laPlata);

  assert.strictEqual(sunNoon.valid, true);
  assert.strictEqual(sunNoon.aboveHorizon, true);
  assert.ok(sunNoon.azimuthDegrees >= 0.0 && sunNoon.azimuthDegrees < 360.0, 'Azimut fuera de rango');
  assert.ok(sunNoon.elevationDegrees > 50.0 && sunNoon.elevationDegrees < 90.0,
    `Elevación esperada entre 50 y 90, obtenida: ${sunNoon.elevationDegrees}`);

  // Medianoche: el sol debe estar bajo el horizonte
  const midnight = { year: 2026, month: 1, day: 15, hour: 0, minute: 0, second: 0 };
  const sunMidnight = calc.calculate(midnight, laPlata);
  assert.strictEqual(sunMidnight.valid, true);
  assert.strictEqual(sunMidnight.aboveHorizon, false);
  assert.ok(sunMidnight.elevationDegrees < 0.0, 'El sol no debería estar sobre el horizonte a medianoche');
  console.log(`  -> OK: SolarCalculator validado (Elevación mediodía: ${sunNoon.elevationDegrees.toFixed(2)}°, Azimut: ${sunNoon.azimuthDegrees.toFixed(2)}°).`);
}

// =========================================================================
// Test 4: HelioSimulator - Seguimiento diferencial y zonas muertas
// =========================================================================
function testTrackingLogic() {
  console.log('[4/8] Verificando seguimiento por LDRs, deadband y límites de movimiento...');
  const sim = new Helios.HelioSimulator();

  // Ajustar configuración rápida para pruebas (análoga a fastConfig() de C++)
  sim.config.tracking.updateIntervalMs = 50;
  sim.config.tracking.lightRecoveryDelayMs = 0;
  sim.config.tracking.darknessDelayMs = 100;
  sim.config.tracking.windRecoveryDelayMs = 100;
  sim.config.tracking.deadbandPercent = 6;
  sim.config.tracking.stepDegrees = 1.0;
  sim.config.azimuth.initialAngle = 90.0;
  sim.config.elevation.initialAngle = 20.0;
  sim.reset();

  // Sensor con asimetría marcada hacia la izquierda (left = 900+900=1800, right = 300+300=600)
  const asymmetricLight = {
    topLeft: 900,
    topRight: 300,
    bottomLeft: 900,
    bottomRight: 300,
    average: 600
  };

  // Simular paso de actualización
  sim.update(50, { light: asymmetricLight });

  assert.strictEqual(sim.state, Helios.ControllerState.TRACKING);
  assert.strictEqual(sim.azimuthTarget, 91.0, 'El azimut debería haber avanzado +1.0° hacia la luz');
  assert.strictEqual(sim.elevationTarget, 20.0, 'La elevación debería mantenerse igual');

  // Caso dentro de la zona muerta: diferencia < 6%
  const balancedLight = {
    topLeft: 500,
    topRight: 495,
    bottomLeft: 500,
    bottomRight: 495,
    average: 497
  };
  sim.update(50, { light: balancedLight });
  // El azimut no debe variar
  assert.strictEqual(sim.azimuthTarget, 91.0, 'La zona muerta no debería alterar el objetivo');

  // Comprobar rechazo de ángulo manual fuera de límites
  assert.strictEqual(sim.setManualTarget(181.0, 45.0), false);
  assert.strictEqual(sim.setManualTarget(100.0, 45.0), true);
  assert.strictEqual(sim.mode, Helios.OperatingMode.MANUAL);
  console.log('  -> OK: Lógica de seguimiento y deadband verificada.');
}

// =========================================================================
// Test 5: HelioSimulator - Estacionamiento Nocturno
// =========================================================================
function testNightParking() {
  console.log('[5/8] Verificando transición de estacionamiento nocturno...');
  const sim = new Helios.HelioSimulator();
  sim.config.tracking.updateIntervalMs = 50;
  sim.config.tracking.darknessDelayMs = 100;
  sim.config.tracking.darknessThreshold = 120;
  sim.config.azimuth.parkAngle = 90.0;
  sim.config.elevation.parkAngle = 20.0;
  sim.reset();

  const darkLight = { topLeft: 10, topRight: 10, bottomLeft: 10, bottomRight: 10, average: 10 };

  // Primera actualización en oscuridad: pasa a WAITING_LIGHT esperando el temporizador
  sim.update(50, { light: darkLight });
  assert.strictEqual(sim.state, Helios.ControllerState.WAITING_FOR_LIGHT);

  // Transcurre el tiempo configurado (100 ms)
  sim.update(100, { light: darkLight });
  assert.strictEqual(sim.state, Helios.ControllerState.NIGHT_PARK);
  assert.strictEqual(sim.azimuthTarget, sim.config.azimuth.parkAngle);
  assert.strictEqual(sim.elevationTarget, sim.config.elevation.parkAngle);
  console.log('  -> OK: Transición a NIGHT_PARK correcta.');
}

// =========================================================================
// Test 6: HelioSimulator - Viento y Parada de Emergencia
// =========================================================================
function testWindAndEmergency() {
  console.log('[6/8] Verificando resguardo por viento y parada de emergencia...');
  const sim = new Helios.HelioSimulator();
  sim.config.azimuth.stowAngle = 90.0;
  sim.config.elevation.stowAngle = 15.0;
  sim.reset();

  // 1. Activar sensor de viento
  sim.update(50, { safety: { wind: true, emergencyStop: false } });
  assert.strictEqual(sim.state, Helios.ControllerState.WIND_STOW);
  assert.strictEqual(sim.azimuthTarget, 90.0);
  assert.strictEqual(sim.elevationTarget, 15.0);

  // 2. Activar parada de emergencia
  sim.update(50, { safety: { wind: false, emergencyStop: true } });
  assert.strictEqual(sim.state, Helios.ControllerState.FAULT);
  assert.ok((sim.faults & Helios.Fault.FAULT_EMERGENCY) !== 0);

  // Intentar borrar fallas mientras la emergencia está activa debe fallar
  assert.strictEqual(sim.clearFaults(), false);

  // Desactivar emergencia y borrar fallas
  sim.safety.emergencyStop = false;
  sim.update(50);
  assert.strictEqual(sim.clearFaults(), true);
  assert.strictEqual(sim.mode, Helios.OperatingMode.STOPPED);
  assert.strictEqual(sim.state, Helios.ControllerState.STOPPED);
  console.log('  -> OK: Protección de viento y enclavamiento de emergencia validados.');
}

// =========================================================================
// Test 7: EnergyYieldCalculator - Rendimiento y Ganancia Energética (+25..35%)
// =========================================================================
function testEnergyYield() {
  console.log('[7/8] Verificando modelo de radiación solar y ganancia del seguidor...');
  const location = Helios.LocationPresets.LA_PLATA;
  const date = { year: 2026, month: 1, day: 15 };

  const yieldData = Helios.EnergyYieldCalculator.calculateDailyYield(date, location, 1.6, 20.0);

  assert.strictEqual(yieldData.hours.length, 24);
  assert.ok(yieldData.yieldKWh.dualAxis > 0, 'La energía generada por el seguidor debe ser positiva');
  assert.ok(yieldData.yieldKWh.fixedOptimum > 0, 'La energía fija óptima debe ser positiva');
  assert.ok(yieldData.yieldKWh.dualAxis > yieldData.yieldKWh.fixedOptimum,
    'El seguidor de dos ejes debe superar en energía al panel fijo');

  // En verano con cielo despejado, la ganancia sobre el fijo óptimo suele rondar entre 25% y 40%
  assert.ok(yieldData.gainOverFixedOptPercent >= 20.0,
    `La ganancia del seguidor debe ser >= 20%, obtenida: ${yieldData.gainOverFixedOptPercent}%`);

  console.log(`  -> OK: Modelo energético verificado (Dual: ${yieldData.yieldKWh.dualAxis} kWh, Fijo: ${yieldData.yieldKWh.fixedOptimum} kWh, Ganancia: +${yieldData.gainOverFixedOptPercent}%).`);
}

// =========================================================================
// Test 8: Consola Serie y Generador de Sketch
// =========================================================================
function testSerialAndSketch() {
  console.log('[8/8] Verificando emulador de consola serie y generador de sketch...');
  const sim = new Helios.HelioSimulator();
  const consoleSim = new Helios.SerialConsoleEmulator(sim);

  assert.strictEqual(consoleSim.execute('VERSION'), Helios.VERSION);

  const helpResp = consoleSim.execute('HELP');
  assert.ok(helpResp.includes('STATUS') && helpResp.includes('MOVE'));

  const statusResp = consoleSim.execute('STATUS');
  assert.ok(statusResp.startsWith('MODE=') && statusResp.includes('STATE=') && statusResp.includes('FAULTS=0x0'));

  const moveResp = consoleSim.execute('MOVE 120 45');
  assert.strictEqual(moveResp, 'OK objetivo manual aceptado');
  assert.strictEqual(sim.azimuthTarget, 120.0);
  assert.strictEqual(sim.elevationTarget, 45.0);

  const stopResp = consoleSim.execute('STOP');
  assert.strictEqual(stopResp, 'OK movimiento detenido');
  assert.strictEqual(sim.mode, Helios.OperatingMode.STOPPED);

  const sketch = Helios.generateArduinoSketch(sim.config);
  assert.ok(sketch.includes('#include <HelioControlDuino.h>'));
  assert.ok(sketch.includes('HelioController controller'));
  assert.ok(sketch.includes('SerialConsole console'));
  console.log('  -> OK: Consola serie y generador de sketch C++ validados.');
}

// Ejecución general
try {
  testMathUtils();
  testDateCalculations();
  testSolarEphemeris();
  testTrackingLogic();
  testNightParking();
  testWindAndEmergency();
  testEnergyYield();
  testSerialAndSketch();
  console.log('\nTodas las pruebas de HeliosEngine pasaron exitosamente (8/8).');
} catch (err) {
  console.error('\nERROR en pruebas:', err);
  process.exit(1);
}
