/**
 * helios-engine.js - Motor de Simulación y Cálculo Astronómico
 * HelioControlDuino v2.0.0
 *
 * Implementa de forma 100% offline:
 * 1. Algoritmo astronómico Meeus (SolarCalculator) idéntico a SolarCalculator.cpp
 * 2. Máquina de estados y cinemática del controlador de doble eje (HelioSimulator)
 * 3. Modelo físico de irradiancia y rendimiento energético (Dual-Axis vs Fijo)
 * 4. Protocolo y consola serie idéntica a HelioSerial.cpp
 * 5. Generador de código C++ / sketch para Arduino IDE
 *
 * Compatible con navegador y entornos CommonJS (Node.js).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HeliosEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '2.0.0';
  const PI = Math.PI;
  const DEG2RAD = PI / 180.0;
  const RAD2DEG = 180.0 / PI;

  // Modos de Operación
  const OperatingMode = {
    AUTOMATIC: 'AUTO',
    PARK: 'PARK',
    STOW: 'STOW',
    MANUAL: 'MANUAL',
    STOPPED: 'STOP'
  };

  // Estados del Controlador
  const ControllerState = {
    STARTING: 'STARTING',
    TRACKING: 'TRACKING',
    WAITING_FOR_LIGHT: 'WAITING_LIGHT',
    NIGHT_PARK: 'NIGHT_PARK',
    PARKED: 'PARKED',
    WIND_STOW: 'WIND_STOW',
    MANUAL: 'MANUAL',
    STOPPED: 'STOPPED',
    FAULT: 'FAULT'
  };

  // Banderas de Fallas (Bitmask)
  const Fault = {
    FAULT_NONE: 0,
    FAULT_INVALID_CONFIG: 1 << 0,  // 0x01
    FAULT_SENSOR: 1 << 1,          // 0x02
    FAULT_EMERGENCY: 1 << 2,       // 0x04
    FAULT_LIMIT_CONFLICT: 1 << 3,  // 0x08
    FAULT_AXIS: 1 << 4,            // 0x10
    FAULT_SAFETY_INPUT: 1 << 5     // 0x20
  };

  // Localizaciones predeterminadas de interés astronómico y solar
  const LocationPresets = {
    LA_PLATA: {
      name: 'La Plata (UNLP), Argentina',
      latitude: -34.9214,
      longitude: -57.9544,
      latitudeDegrees: -34.9214,
      longitudeDegrees: -57.9544,
      utcOffsetMinutes: -180,
      elevationMeters: 18
    },
    BUENOS_AIRES: {
      name: 'Buenos Aires (CABA), Argentina',
      latitude: -34.6037,
      longitude: -58.3816,
      latitudeDegrees: -34.6037,
      longitudeDegrees: -58.3816,
      utcOffsetMinutes: -180,
      elevationMeters: 25
    },
    CORDOBA: {
      name: 'Córdoba, Argentina',
      latitude: -31.4201,
      longitude: -64.1888,
      latitudeDegrees: -31.4201,
      longitudeDegrees: -64.1888,
      utcOffsetMinutes: -180,
      elevationMeters: 390
    },
    ATACAMA: {
      name: 'Desierto de Atacama (Radiación Máxima), Chile',
      latitude: -23.8634,
      longitude: -69.1328,
      latitudeDegrees: -23.8634,
      longitudeDegrees: -69.1328,
      utcOffsetMinutes: -240,
      elevationMeters: 2400
    },
    MADRID: {
      name: 'Madrid, España',
      latitude: 40.4168,
      longitude: -3.7038,
      latitudeDegrees: 40.4168,
      longitudeDegrees: -3.7038,
      utcOffsetMinutes: 60,
      elevationMeters: 650
    },
    EQUATOR: {
      name: 'Ecuador Solar (0°, 0°)',
      latitude: 0.0,
      longitude: 0.0,
      latitudeDegrees: 0.0,
      longitudeDegrees: 0.0,
      utcOffsetMinutes: 0,
      elevationMeters: 0
    }
  };

  // Funciones Matemáticas Auxiliares
  function clamp(val, min, max) {
    if (val < min) return min;
    if (val > max) return max;
    return val;
  }

  function clampUnit(val) {
    return clamp(val, -1.0, 1.0);
  }

  function normalizedDifference(positive, negative, total) {
    if (!total || total === 0) return 0;
    const diff = (positive - negative) * 100;
    const res = Math.floor(diff / total);
    return clamp(res, -100, 100);
  }

  // =========================================================================
  // 1. SolarCalculator (Cálculo Astronómico Offline - Ecuaciones de Meeus / SPA)
  // =========================================================================
  const SolarCalculator = {
    leapYear: function (year) {
      return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    },

    validDateTime: function (dt) {
      if (!dt || typeof dt !== 'object') return false;
      if (dt.year < 2000 || dt.month < 1 || dt.month > 12 ||
          dt.hour < 0 || dt.hour > 23 ||
          dt.minute < 0 || dt.minute > 59 ||
          dt.second < 0 || dt.second > 59) {
        return false;
      }
      const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      let maxDay = daysPerMonth[dt.month - 1];
      if (dt.month === 2 && SolarCalculator.leapYear(dt.year)) {
        maxDay = 29;
      }
      return dt.day >= 1 && dt.day <= maxDay;
    },

    dayOfYear: function (dt) {
      const daysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
      let result = daysBeforeMonth[dt.month - 1] + dt.day;
      if (dt.month > 2 && SolarCalculator.leapYear(dt.year)) {
        result += 1;
      }
      return result;
    },

    calculate: function (localTime, location) {
      const result = {
        azimuthDegrees: 0.0,
        elevationDegrees: -90.0,
        zenithDegrees: 180.0,
        aboveHorizon: false,
        valid: false,
        equationOfTimeMinutes: 0.0,
        declinationDegrees: 0.0,
        hourAngleDegrees: 0.0
      };

      if (!SolarCalculator.validDateTime(localTime) || !location) {
        return result;
      }

      const latDeg = typeof location.latitudeDegrees !== 'undefined' ? location.latitudeDegrees : location.latitude;
      const lonDeg = typeof location.longitudeDegrees !== 'undefined' ? location.longitudeDegrees : location.longitude;
      const utcOffset = typeof location.utcOffsetMinutes !== 'undefined' ? location.utcOffsetMinutes : 0;

      if (typeof latDeg !== 'number' || typeof lonDeg !== 'number' ||
          latDeg < -90.0 || latDeg > 90.0 ||
          lonDeg < -180.0 || lonDeg > 180.0 ||
          utcOffset < -840 || utcOffset > 840) {
        return result;
      }

      const yearDays = SolarCalculator.leapYear(localTime.year) ? 366 : 365;
      const fractionalHour = localTime.hour + localTime.minute / 60.0 + localTime.second / 3600.0;
      const gamma = (2.0 * PI / yearDays) * (SolarCalculator.dayOfYear(localTime) - 1 + (fractionalHour - 12.0) / 24.0);

      // Ecuación del Tiempo (minutos)
      const equationOfTime = 229.18 * (
        0.000075 +
        0.001868 * Math.cos(gamma) -
        0.032077 * Math.sin(gamma) -
        0.014615 * Math.cos(2.0 * gamma) -
        0.040849 * Math.sin(2.0 * gamma)
      );

      // Declinación Solar (radianes)
      const declination = 0.006918 -
        0.399912 * Math.cos(gamma) +
        0.070257 * Math.sin(gamma) -
        0.006758 * Math.cos(2.0 * gamma) +
        0.000907 * Math.sin(2.0 * gamma) -
        0.002697 * Math.cos(3.0 * gamma) +
        0.00148 * Math.sin(3.0 * gamma);

      const localMinutes = localTime.hour * 60.0 + localTime.minute + localTime.second / 60.0;
      const timeOffset = equationOfTime + 4.0 * lonDeg - utcOffset;
      let trueSolarMinutes = (localMinutes + timeOffset) % 1440.0;
      if (trueSolarMinutes < 0.0) {
        trueSolarMinutes += 1440.0;
      }

      let hourAngleDegrees = trueSolarMinutes / 4.0 - 180.0;
      if (hourAngleDegrees < -180.0) {
        hourAngleDegrees += 360.0;
      }

      const latitude = latDeg * DEG2RAD;
      const hourAngle = hourAngleDegrees * DEG2RAD;
      const cosineZenith = clampUnit(
        Math.sin(latitude) * Math.sin(declination) +
        Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle)
      );
      const zenith = Math.acos(cosineZenith);
      const elevation = 90.0 - (zenith * RAD2DEG);

      const azimuthRadians = Math.atan2(
        Math.sin(hourAngle),
        Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(declination) * Math.cos(latitude)
      );
      let azimuthDegrees = ((azimuthRadians * RAD2DEG) + 180.0) % 360.0;
      if (azimuthDegrees < 0.0) {
        azimuthDegrees += 360.0;
      }

      result.azimuthDegrees = azimuthDegrees;
      result.elevationDegrees = elevation;
      result.zenithDegrees = 90.0 - elevation;
      result.aboveHorizon = elevation > 0.0;
      result.declinationDegrees = declination * RAD2DEG;
      result.equationOfTimeMinutes = equationOfTime;
      result.hourAngleDegrees = hourAngleDegrees;
      result.valid = true;

      return result;
    }
  };

  // =========================================================================
  // 2. Configuración Predeterminada del Controlador
  // =========================================================================
  function defaultControllerConfig() {
    return {
      azimuth: {
        minimumAngle: 10.0,
        maximumAngle: 170.0,
        parkAngle: 90.0,
        stowAngle: 90.0,
        initialAngle: 90.0,
        maximumSpeedDegreesPerSecond: 20.0
      },
      elevation: {
        minimumAngle: 15.0,
        maximumAngle: 90.0,
        parkAngle: 20.0,
        stowAngle: 15.0,
        initialAngle: 20.0,
        maximumSpeedDegreesPerSecond: 15.0
      },
      tracking: {
        darknessThreshold: 120,
        deadbandPercent: 6,
        stepDegrees: 1.0,
        azimuthDirection: 1,
        elevationDirection: 1,
        updateIntervalMs: 500,
        darknessDelayMs: 300000,
        lightRecoveryDelayMs: 30000,
        windRecoveryDelayMs: 60000
      }
    };
  }

  // =========================================================================
  // 3. Simulador del Seguidor Solar (HelioSimulator)
  // =========================================================================
  function HelioSimulator(userConfig) {
    this.config = JSON.parse(JSON.stringify(userConfig || defaultControllerConfig()));
    this.reset();
  }

  HelioSimulator.prototype.reset = function () {
    this.begun = true;
    this.mode = OperatingMode.AUTOMATIC;
    this.state = ControllerState.WAITING_FOR_LIGHT;
    this.faults = Fault.FAULT_NONE;

    this.azimuthPosition = this.config.azimuth.initialAngle;
    this.azimuthTarget = this.config.azimuth.initialAngle;
    this.elevationPosition = this.config.elevation.initialAngle;
    this.elevationTarget = this.config.elevation.initialAngle;

    this.azimuthErrorPercent = 0;
    this.elevationErrorPercent = 0;

    this.light = {
      topLeft: 600,
      topRight: 600,
      bottomLeft: 600,
      bottomRight: 600,
      average: 600
    };

    this.safety = {
      wind: false,
      emergencyStop: false,
      azimuthMinimum: false,
      azimuthMaximum: false,
      elevationMinimum: false,
      elevationMaximum: false
    };

    this.millis = 0;
    this.updateCount = 0;

    this.darkTimerActive = false;
    this.darkSince = 0;
    this.lightRecoveryActive = false;
    this.lightSince = 0;
    this.windRecoveryActive = false;
    this.windWasActive = false;
    this.windClearSince = 0;
    this.lastAutomaticUpdate = -this.config.tracking.updateIntervalMs;
  };

  HelioSimulator.prototype.setManualTarget = function (azimuth, elevation) {
    if (!this.begun || this.faults !== Fault.FAULT_NONE ||
        this.safety.emergencyStop || this.safety.wind) {
      return false;
    }
    if (azimuth < this.config.azimuth.minimumAngle ||
        azimuth > this.config.azimuth.maximumAngle ||
        elevation < this.config.elevation.minimumAngle ||
        elevation > this.config.elevation.maximumAngle) {
      return false;
    }
    this.mode = OperatingMode.MANUAL;
    this.azimuthTarget = clamp(azimuth, this.config.azimuth.minimumAngle, this.config.azimuth.maximumAngle);
    this.elevationTarget = clamp(elevation, this.config.elevation.minimumAngle, this.config.elevation.maximumAngle);
    this.state = ControllerState.MANUAL;
    return true;
  };

  HelioSimulator.prototype.setMode = function (mode) {
    if (!this.begun || this.faults !== Fault.FAULT_NONE) {
      return false;
    }
    this.mode = mode;
    this.lightRecoveryActive = false;
    this.darkTimerActive = false;

    if (mode === OperatingMode.PARK) {
      this.azimuthTarget = this.config.azimuth.parkAngle;
      this.elevationTarget = this.config.elevation.parkAngle;
      this.state = ControllerState.PARKED;
    } else if (mode === OperatingMode.STOW) {
      this.azimuthTarget = this.config.azimuth.stowAngle;
      this.elevationTarget = this.config.elevation.stowAngle;
      this.state = ControllerState.WIND_STOW;
    } else if (mode === OperatingMode.STOPPED) {
      this.azimuthTarget = this.azimuthPosition;
      this.elevationTarget = this.elevationPosition;
      this.state = ControllerState.STOPPED;
    }
    return true;
  };

  HelioSimulator.prototype.clearFaults = function () {
    if (!this.begun || this.safety.emergencyStop ||
        (this.safety.azimuthMinimum && this.safety.azimuthMaximum) ||
        (this.safety.elevationMinimum && this.safety.elevationMaximum)) {
      return false;
    }
    this.faults = Fault.FAULT_NONE;
    this.mode = OperatingMode.STOPPED;
    this.state = ControllerState.STOPPED;
    this.azimuthTarget = this.azimuthPosition;
    this.elevationTarget = this.elevationPosition;
    return true;
  };

  /**
   * Modela la respuesta de los 4 LDRs bajo el divisor en cruz ante la posición del sol
   * SunAzimuth, SunElevation, AmbientLux, DirectBeamLux
   */
  HelioSimulator.prototype.calculateOpticalQuadrantReadings = function (sunAzimuth, sunElevation, directIrradiance, ambientIrradiance) {
    if (typeof directIrradiance === 'undefined') directIrradiance = 850;
    if (typeof ambientIrradiance === 'undefined') ambientIrradiance = 80;

    if (sunElevation <= 0) {
      // Noche
      return {
        topLeft: 15,
        topRight: 15,
        bottomLeft: 15,
        bottomRight: 15,
        average: 15
      };
    }

    // Diferencias angulares relativas respecto de la orientación del panel
    const deltaAz = (sunAzimuth - this.azimuthPosition);
    const deltaEl = (sunElevation - this.elevationPosition);

    // Separador en cruz:
    // deltaAz > 0 => Sol a la derecha del panel => lado derecho recibe luz, lado izquierdo recibe sombra
    // En HelioController.cpp:
    // left = TL + BL; right = TR + BR;
    // azErr = normalizedDifference(left, right, total);
    // if azErr > deadband: azimuth += step * azDir (+1)
    // Para que el seguidor se mueva hacia la derecha (+az), el algoritmo requiere azErr > 0 => left > right.
    // Esto corresponde al montaje físico donde el sensor izquierdo mira hacia el sol o la sombra del baffle cae en el opuesto.
    // Usamos el signo exacto de HelioController:
    // azOffset > 0 => aumenta TL y BL
    // elOffset > 0 => aumenta TL y TR

    const maxDeflection = 45.0; // grados para sombra completa
    const shadowFactorAz = clamp(deltaAz / maxDeflection, -1.0, 1.0);
    const shadowFactorEl = clamp(deltaEl / maxDeflection, -1.0, 1.0);

    // Coeficientes normalizados por cuadrante [0.1 .. 1.0]
    // Top-Left: +Az, +El
    // Top-Right: -Az, +El
    // Bottom-Left: +Az, -El
    // Bottom-Right: -Az, -El
    const fTL = clamp(1.0 + 0.6 * shadowFactorAz + 0.6 * shadowFactorEl, 0.1, 1.5);
    const fTR = clamp(1.0 - 0.6 * shadowFactorAz + 0.6 * shadowFactorEl, 0.1, 1.5);
    const fBL = clamp(1.0 + 0.6 * shadowFactorAz - 0.6 * shadowFactorEl, 0.1, 1.5);
    const fBR = clamp(1.0 - 0.6 * shadowFactorAz - 0.6 * shadowFactorEl, 0.1, 1.5);

    const baseBeam = (directIrradiance / 1000.0) * 800.0 * Math.max(0, Math.sin(sunElevation * DEG2RAD));
    const baseAmbient = (ambientIrradiance / 100.0) * 80.0;

    const tl = Math.round(clamp(baseAmbient + baseBeam * fTL, 10, 1023));
    const tr = Math.round(clamp(baseAmbient + baseBeam * fTR, 10, 1023));
    const bl = Math.round(clamp(baseAmbient + baseBeam * fBL, 10, 1023));
    const br = Math.round(clamp(baseAmbient + baseBeam * fBR, 10, 1023));
    const avg = Math.round((tl + tr + bl + br) / 4);

    return {
      topLeft: tl,
      topRight: tr,
      bottomLeft: bl,
      bottomRight: br,
      average: avg
    };
  };

  /**
   * Avanza la simulación por deltaMs (milisegundos)
   */
  HelioSimulator.prototype.update = function (deltaMs, overrideSensors) {
    if (typeof deltaMs === 'undefined') deltaMs = 50;
    this.millis += deltaMs;

    // 1. Cinemática de los Servomotores (slew rate hacia los objetivos)
    const dtSeconds = deltaMs / 1000.0;
    const maxAzStep = this.config.azimuth.maximumSpeedDegreesPerSecond * dtSeconds;
    const azDiff = this.azimuthTarget - this.azimuthPosition;
    if (Math.abs(azDiff) <= maxAzStep) {
      this.azimuthPosition = this.azimuthTarget;
    } else {
      this.azimuthPosition += Math.sign(azDiff) * maxAzStep;
    }

    const maxElStep = this.config.elevation.maximumSpeedDegreesPerSecond * dtSeconds;
    const elDiff = this.elevationTarget - this.elevationPosition;
    if (Math.abs(elDiff) <= maxElStep) {
      this.elevationPosition = this.elevationTarget;
    } else {
      this.elevationPosition += Math.sign(elDiff) * maxElStep;
    }

    // 2. Sensores externos (si se proveen overrides)
    if (overrideSensors) {
      if (overrideSensors.light) {
        this.light = overrideSensors.light;
      }
      if (overrideSensors.safety) {
        Object.assign(this.safety, overrideSensors.safety);
      }
    }

    // 3. Verificación de Seguridad y Paradas
    if (this.safety.emergencyStop) {
      this.faults |= Fault.FAULT_EMERGENCY;
    }

    if ((this.safety.azimuthMinimum && this.safety.azimuthMaximum) ||
        (this.safety.elevationMinimum && this.safety.elevationMaximum)) {
      this.faults |= Fault.FAULT_LIMIT_CONFLICT;
    }

    if (this.faults !== Fault.FAULT_NONE) {
      this.state = ControllerState.FAULT;
      return;
    }

    // 4. Manejo de Viento
    if (this.handleWind(this.millis)) {
      return;
    }

    // 5. Máquina de Estados por Modo
    switch (this.mode) {
      case OperatingMode.AUTOMATIC:
        this.runAutomatic(this.millis);
        break;
      case OperatingMode.PARK:
        this.azimuthTarget = this.config.azimuth.parkAngle;
        this.elevationTarget = this.config.elevation.parkAngle;
        this.state = ControllerState.PARKED;
        break;
      case OperatingMode.STOW:
        this.azimuthTarget = this.config.azimuth.stowAngle;
        this.elevationTarget = this.config.elevation.stowAngle;
        this.state = ControllerState.WIND_STOW;
        break;
      case OperatingMode.MANUAL:
        this.state = ControllerState.MANUAL;
        break;
      case OperatingMode.STOPPED:
        this.azimuthTarget = this.azimuthPosition;
        this.elevationTarget = this.elevationPosition;
        this.state = ControllerState.STOPPED;
        break;
    }
  };

  HelioSimulator.prototype.handleWind = function (now) {
    if (this.safety.wind) {
      this.windWasActive = true;
      this.windRecoveryActive = false;
      this.azimuthTarget = this.config.azimuth.stowAngle;
      this.elevationTarget = this.config.elevation.stowAngle;
      this.state = ControllerState.WIND_STOW;
      return true;
    }

    if (!this.windWasActive) {
      this.windRecoveryActive = false;
      return false;
    }

    if (!this.windRecoveryActive) {
      this.windRecoveryActive = true;
      this.windClearSince = now;
    }

    if ((now - this.windClearSince) < this.config.tracking.windRecoveryDelayMs) {
      this.azimuthTarget = this.config.azimuth.stowAngle;
      this.elevationTarget = this.config.elevation.stowAngle;
      this.state = ControllerState.WIND_STOW;
      return true;
    }

    this.windRecoveryActive = false;
    this.windWasActive = false;
    return false;
  };

  HelioSimulator.prototype.runAutomatic = function (now) {
    if ((now - this.lastAutomaticUpdate) < this.config.tracking.updateIntervalMs) {
      return;
    }
    this.lastAutomaticUpdate = now;
    this.updateCount++;

    const reading = this.light;

    // Verificación de oscuridad (estacionamiento nocturno)
    if (reading.average < this.config.tracking.darknessThreshold) {
      this.lightRecoveryActive = false;
      if (!this.darkTimerActive) {
        this.darkTimerActive = true;
        this.darkSince = now;
      }

      if ((now - this.darkSince) >= this.config.tracking.darknessDelayMs) {
        this.azimuthTarget = this.config.azimuth.parkAngle;
        this.elevationTarget = this.config.elevation.parkAngle;
        this.state = ControllerState.NIGHT_PARK;
      } else {
        this.state = ControllerState.WAITING_FOR_LIGHT;
      }
      return;
    }

    this.darkTimerActive = false;

    // Recuperación de luz tras oscuridad
    if (this.state === ControllerState.NIGHT_PARK ||
        this.state === ControllerState.WAITING_FOR_LIGHT) {
      if (!this.lightRecoveryActive) {
        this.lightRecoveryActive = true;
        this.lightSince = now;
      }

      if ((now - this.lightSince) < this.config.tracking.lightRecoveryDelayMs) {
        this.state = ControllerState.WAITING_FOR_LIGHT;
        return;
      }
    }

    this.lightRecoveryActive = false;
    this.moveTowardLight(reading);
    this.state = ControllerState.TRACKING;
  };

  HelioSimulator.prototype.moveTowardLight = function (reading) {
    const total = reading.topLeft + reading.topRight + reading.bottomLeft + reading.bottomRight;
    const left = reading.topLeft + reading.bottomLeft;
    const right = reading.topRight + reading.bottomRight;
    const top = reading.topLeft + reading.topRight;
    const bottom = reading.bottomLeft + reading.bottomRight;

    this.azimuthErrorPercent = normalizedDifference(left, right, total);
    this.elevationErrorPercent = normalizedDifference(top, bottom, total);

    let azimuth = this.azimuthTarget;
    let elevation = this.elevationTarget;
    const deadband = this.config.tracking.deadbandPercent;

    if (this.azimuthErrorPercent > deadband) {
      azimuth += this.config.tracking.stepDegrees * this.config.tracking.azimuthDirection;
    } else if (this.azimuthErrorPercent < -deadband) {
      azimuth -= this.config.tracking.stepDegrees * this.config.tracking.azimuthDirection;
    }

    if (this.elevationErrorPercent > deadband) {
      elevation += this.config.tracking.stepDegrees * this.config.tracking.elevationDirection;
    } else if (this.elevationErrorPercent < -deadband) {
      elevation -= this.config.tracking.stepDegrees * this.config.tracking.elevationDirection;
    }

    this.azimuthTarget = clamp(azimuth, this.config.azimuth.minimumAngle, this.config.azimuth.maximumAngle);
    this.elevationTarget = clamp(elevation, this.config.elevation.minimumAngle, this.config.elevation.maximumAngle);
  };

  HelioSimulator.prototype.getStatus = function () {
    return {
      mode: this.mode,
      state: this.state,
      faults: this.faults,
      azimuthPosition: Number(this.azimuthPosition.toFixed(1)),
      elevationPosition: Number(this.elevationPosition.toFixed(1)),
      azimuthTarget: Number(this.azimuthTarget.toFixed(1)),
      elevationTarget: Number(this.elevationTarget.toFixed(1)),
      azimuthErrorPercent: this.azimuthErrorPercent,
      elevationErrorPercent: this.elevationErrorPercent,
      light: Object.assign({}, this.light),
      safety: Object.assign({}, this.safety),
      updateCount: this.updateCount,
      millis: this.millis
    };
  };

  // =========================================================================
  // 4. Modelo Físico de Rendimiento Energético (Dual-Axis vs Fijo)
  // =========================================================================
  const EnergyYieldCalculator = {
    /**
     * Calcula la curva horaria de radiación y energía acumulada diaria
     * para una fecha y ubicación determinadas.
     */
    calculateDailyYield: function (date, location, panelAreaM2, panelEfficiencyPercent) {
      if (!panelAreaM2) panelAreaM2 = 1.6; // Panel solar fotovoltaico estándar (~300-400W)
      if (!panelEfficiencyPercent) panelEfficiencyPercent = 20.0; // 20% eficiencia típica de celda de silicio monocristalino

      const efficiency = panelEfficiencyPercent / 100.0;
      const hoursData = [];
      let totalDualWh = 0;
      let totalFixedOptWh = 0;
      let totalFixedFlatWh = 0;

      const lat = typeof location.latitudeDegrees !== 'undefined' ? location.latitudeDegrees : location.latitude;
      // Inclinación óptima fija para la latitud dada: beta = |latitud|
      const optTiltDegrees = Math.abs(lat);
      // Azimut del panel fijo: mirando hacia el ecuador (Norte en hemisferio sur = 0° o 360°, Sur en hemisferio norte = 180°)
      const surfaceAzimuthDegrees = lat < 0 ? 0.0 : 180.0;

      // Paso de muestreo de 15 minutos (0.25 h)
      const stepMinutes = 15;
      const stepsInDay = (24 * 60) / stepMinutes;

      for (let i = 0; i < stepsInDay; i++) {
        const totalMinutes = i * stepMinutes;
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;

        const time = {
          year: date.year,
          month: date.month,
          day: date.day,
          hour: hour,
          minute: minute,
          second: 0
        };

        const sun = SolarCalculator.calculate(time, location);

        let dni = 0; // Direct Normal Irradiance (W/m2)
        let dhi = 0; // Diffuse Horizontal Irradiance (W/m2)
        let pDual = 0; // W
        let pFixedOpt = 0; // W
        let pFixedFlat = 0; // W

        if (sun.valid && sun.aboveHorizon) {
          const elevRad = sun.elevationDegrees * DEG2RAD;
          const sinElev = Math.sin(elevRad);

          // Modelo de atmósfera clara (Hottel Clear-Sky Approximation)
          const solarConstant = 1361.0 * (1.0 + 0.033 * Math.cos(2.0 * PI * SolarCalculator.dayOfYear(time) / 365.0));
          const airMass = 1.0 / (sinElev + 0.50572 * Math.pow(6.07995 + sun.elevationDegrees, -1.6364));
          const atmosphericTransmittance = 0.70;

          dni = solarConstant * Math.pow(atmosphericTransmittance, Math.pow(airMass, 0.678));
          dhi = 0.12 * solarConstant * sinElev;

          // 1. Seguidor de Dos Ejes (Dual-Axis Tracker):
          // Mantiene la normal de la superficie alineada con el vector solar (cos theta = 1.0)
          const irrDual = dni + dhi;
          pDual = irrDual * panelAreaM2 * efficiency;

          // 2. Fijo Plano Horizontal (Fixed Flat):
          // cos theta = sin(elev)
          const irrFlat = dni * sinElev + dhi;
          pFixedFlat = irrFlat * panelAreaM2 * efficiency;

          // 3. Fijo Óptimo (Fixed Optimum Tilt):
          // cos theta = sin(elev)*cos(beta) + cos(elev)*sin(beta)*cos(azSun - azSurf)
          const betaRad = optTiltDegrees * DEG2RAD;
          const azDiffRad = (sun.azimuthDegrees - surfaceAzimuthDegrees) * DEG2RAD;
          const cosThetaFixed = sinElev * Math.cos(betaRad) + Math.cos(elevRad) * Math.sin(betaRad) * Math.cos(azDiffRad);
          const effectiveCosFixed = Math.max(0, cosThetaFixed);

          const skyDiffTilt = dhi * (1.0 + Math.cos(betaRad)) / 2.0;
          const irrFixedOpt = dni * effectiveCosFixed + skyDiffTilt;
          pFixedOpt = irrFixedOpt * panelAreaM2 * efficiency;
        }

        const dtHours = stepMinutes / 60.0;
        totalDualWh += pDual * dtHours;
        totalFixedOptWh += pFixedOpt * dtHours;
        totalFixedFlatWh += pFixedFlat * dtHours;

        if (minute === 0) {
          hoursData.push({
            hour: hour,
            timeLabel: `${String(hour).padStart(2, '0')}:00`,
            solarElevation: Number(sun.elevationDegrees.toFixed(1)),
            solarAzimuth: Number(sun.azimuthDegrees.toFixed(1)),
            powerDualWatts: Math.round(pDual),
            powerFixedOptWatts: Math.round(pFixedOpt),
            powerFixedFlatWatts: Math.round(pFixedFlat)
          });
        }
      }

      const totalDualKWh = totalDualWh / 1000.0;
      const totalFixedOptKWh = totalFixedOptWh / 1000.0;
      const totalFixedFlatKWh = totalFixedFlatWh / 1000.0;

      const gainOverFixedOptPercent = totalFixedOptKWh > 0
        ? Number((((totalDualKWh - totalFixedOptKWh) / totalFixedOptKWh) * 100.0).toFixed(1))
        : 0;

      const gainOverFlatPercent = totalFixedFlatKWh > 0
        ? Number((((totalDualKWh - totalFixedFlatKWh) / totalFixedFlatKWh) * 100.0).toFixed(1))
        : 0;

      return {
        date: date,
        location: location,
        optTiltDegrees: optTiltDegrees,
        panelAreaM2: panelAreaM2,
        panelEfficiencyPercent: panelEfficiencyPercent,
        hours: hoursData,
        yieldKWh: {
          dualAxis: Number(totalDualKWh.toFixed(3)),
          fixedOptimum: Number(totalFixedOptKWh.toFixed(3)),
          fixedFlat: Number(totalFixedFlatKWh.toFixed(3))
        },
        gainOverFixedOptPercent: gainOverFixedOptPercent,
        gainOverFlatPercent: gainOverFlatPercent
      };
    }
  };

  // =========================================================================
  // 5. Consola y Protocolo Serie (Emula HelioSerial.cpp)
  // =========================================================================
  function SerialConsoleEmulator(simulator) {
    this.sim = simulator;
  }

  SerialConsoleEmulator.prototype.execute = function (rawLine) {
    if (!rawLine) return '';
    const clean = rawLine.trim().toUpperCase();
    if (!clean) return '';

    const parts = clean.split(/\s+/);
    const cmd = parts[0];

    if (cmd === 'HELP' || cmd === '?') {
      return [
        'HELP              lista de comandos',
        'STATUS            estado y lecturas',
        'AUTO              seguimiento automatico',
        'PARK              posicion de estacionamiento',
        'STOW              posicion de resguardo',
        'STOP              detener movimiento',
        'MOVE <az> <el>    objetivo manual en grados',
        'RESET             borrar fallas si es seguro',
        'VERSION           version del firmware'
      ].join('\r\n');
    }

    if (cmd === 'STATUS') {
      const s = this.sim.getStatus();
      return `MODE=${s.mode} STATE=${s.state} FAULTS=0x${s.faults.toString(16).toUpperCase()} AZ=${s.azimuthPosition.toFixed(1)}/${s.azimuthTarget.toFixed(1)} EL=${s.elevationPosition.toFixed(1)}/${s.elevationTarget.toFixed(1)} LIGHT=${s.light.average} ERR=${s.azimuthErrorPercent},${s.elevationErrorPercent} WIND=${s.safety.wind ? 1 : 0} ESTOP=${s.safety.emergencyStop ? 1 : 0}`;
    }

    if (cmd === 'AUTO') {
      if (this.sim.faults !== Fault.FAULT_NONE) {
        return 'ERROR hay una falla activa; use STATUS y RESET';
      }
      this.sim.setMode(OperatingMode.AUTOMATIC);
      return 'OK modo automatico';
    }

    if (cmd === 'PARK') {
      if (this.sim.faults !== Fault.FAULT_NONE) {
        return 'ERROR hay una falla activa; use STATUS y RESET';
      }
      this.sim.setMode(OperatingMode.PARK);
      return 'OK estacionando';
    }

    if (cmd === 'STOW') {
      if (this.sim.faults !== Fault.FAULT_NONE) {
        return 'ERROR hay una falla activa; use STATUS y RESET';
      }
      this.sim.setMode(OperatingMode.STOW);
      return 'OK posicion de resguardo';
    }

    if (cmd === 'STOP') {
      this.sim.setMode(OperatingMode.STOPPED);
      return 'OK movimiento detenido';
    }

    if (cmd === 'RESET') {
      if (this.sim.clearFaults()) {
        return 'OK fallas borradas; controlador detenido';
      }
      return 'ERROR la condicion insegura continua activa';
    }

    if (cmd === 'VERSION') {
      return VERSION;
    }

    if (cmd === 'MOVE') {
      if (parts.length !== 3) {
        return 'ERROR uso: MOVE <azimut> <elevacion>';
      }
      const az = parseFloat(parts[1]);
      const el = parseFloat(parts[2]);
      if (isNaN(az) || isNaN(el)) {
        return 'ERROR uso: MOVE <azimut> <elevacion>';
      }
      if (!this.sim.setManualTarget(az, el)) {
        return 'ERROR objetivo fuera de limites o condicion insegura';
      }
      return 'OK objetivo manual aceptado';
    }

    return 'ERROR comando desconocido; use HELP';
  };

  // =========================================================================
  // 6. Generador de Código Arduino C++ (Sketch Exporter)
  // =========================================================================
  function generateArduinoSketch(cfg, pinout) {
    const p = Object.assign({
      ldrTopLeft: 'A0',
      ldrTopRight: 'A1',
      ldrBottomLeft: 'A2',
      ldrBottomRight: 'A3',
      servoAzimuth: 9,
      servoElevation: 10,
      pinWind: 'PIN_UNUSED',
      pinEmergency: 'PIN_UNUSED',
      pinLed: 'LED_BUILTIN'
    }, pinout);

    const c = cfg || defaultControllerConfig();

    return `// =========================================================================
// HelioControlDuino v${VERSION} - Firmware de Seguidor Solar Autónomo
// Generado automáticamente por HelioControlDuino Workbench
// =========================================================================

#include <Arduino.h>
#include <Servo.h>
#include <HelioControlDuino.h>

using namespace heliocontrol;

// Asignación de Pines
const int8_t PIN_LDR_TL = ${p.ldrTopLeft};
const int8_t PIN_LDR_TR = ${p.ldrTopRight};
const int8_t PIN_LDR_BL = ${p.ldrBottomLeft};
const int8_t PIN_LDR_BR = ${p.ldrBottomRight};
const uint8_t PIN_SERVO_AZ = ${p.servoAzimuth};
const uint8_t PIN_SERVO_EL = ${p.servoElevation};
const int8_t PIN_WIND = ${p.pinWind};
const int8_t PIN_ESTOP = ${p.pinEmergency};
const int8_t PIN_LED = ${p.pinLed};

// Instancias de Hardware
AnalogLightSensor lightSensor(PIN_LDR_TL, PIN_LDR_TR, PIN_LDR_BL, PIN_LDR_BR);
ServoAxisDriver azimuthAxis(PIN_SERVO_AZ);
ServoAxisDriver elevationAxis(PIN_SERVO_EL);
DigitalSafetyInputs safetyInputs(PIN_WIND, PIN_ESTOP);

HelioController controller(azimuthAxis, elevationAxis, lightSensor, &safetyInputs);
SerialConsole console(Serial, controller);

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000);

  ControllerConfig config = defaultControllerConfig();

  // Configuración de límites y ángulos
  config.azimuth.minimumAngle = ${c.azimuth.minimumAngle.toFixed(1)}f;
  config.azimuth.maximumAngle = ${c.azimuth.maximumAngle.toFixed(1)}f;
  config.azimuth.parkAngle = ${c.azimuth.parkAngle.toFixed(1)}f;
  config.azimuth.stowAngle = ${c.azimuth.stowAngle.toFixed(1)}f;

  config.elevation.minimumAngle = ${c.elevation.minimumAngle.toFixed(1)}f;
  config.elevation.maximumAngle = ${c.elevation.maximumAngle.toFixed(1)}f;
  config.elevation.parkAngle = ${c.elevation.parkAngle.toFixed(1)}f;
  config.elevation.stowAngle = ${c.elevation.stowAngle.toFixed(1)}f;

  // Parámetros de seguimiento
  config.tracking.darknessThreshold = ${c.tracking.darknessThreshold};
  config.tracking.deadbandPercent = ${c.tracking.deadbandPercent};
  config.tracking.stepDegrees = ${c.tracking.stepDegrees.toFixed(1)}f;
  config.tracking.updateIntervalMs = ${c.tracking.updateIntervalMs}UL;

  if (!controller.begin(config)) {
    Serial.println(F("ERROR: fallo al inicializar el controlador"));
  }

  console.begin(true);
}

void loop() {
  controller.update();
  console.poll();
}
`;
  }

  // Exportar el módulo completo
  return {
    VERSION: VERSION,
    OperatingMode: OperatingMode,
    ControllerState: ControllerState,
    Fault: Fault,
    LocationPresets: LocationPresets,
    SolarCalculator: SolarCalculator,
    defaultControllerConfig: defaultControllerConfig,
    HelioSimulator: HelioSimulator,
    EnergyYieldCalculator: EnergyYieldCalculator,
    SerialConsoleEmulator: SerialConsoleEmulator,
    generateArduinoSketch: generateArduinoSketch,
    normalizedDifference: normalizedDifference,
    clamp: clamp
  };
});
