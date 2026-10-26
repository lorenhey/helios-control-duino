/**
 * app.js - Interfaz Interactiva de HelioControlDuino Workbench
 * HelioControlDuino v2.0.0
 */

(function () {
  'use strict';

  const Helios = window.HeliosEngine;
  if (!Helios) {
    console.error('HeliosEngine no encontrado.');
    return;
  }

  // 1. Instancias del Simulador y Consola
  const sim = new Helios.HelioSimulator();
  const serialConsole = new Helios.SerialConsoleEmulator(sim);

  // Variables de Estado de la UI
  let linkedSunToAstronomical = false;
  let liveTimeActive = false;
  let liveTimeTimer = null;
  let lastFrameTime = performance.now();

  // Variables de Control Solar Manual
  const environment = {
    sunAzimuth: 95.0,
    sunElevation: 45.0,
    irradianceDNI: 850,
    windSpeedKmH: 12
  };

  // 2. Elementos del DOM
  const dom = {
    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),

    // Header pills
    dotMode: document.getElementById('dot-mode'),
    dotState: document.getElementById('dot-state'),
    pillModeText: document.getElementById('pill-mode-text'),
    pillStateText: document.getElementById('pill-state-text'),
    pillAzText: document.getElementById('pill-az-text'),
    pillElText: document.getElementById('pill-el-text'),
    pillGainText: document.getElementById('pill-gain-text'),

    // Visualizador de Seguidor
    badgeControllerState: document.getElementById('badge-controller-state'),
    sunGroup: document.getElementById('sun-group'),
    sunRay: document.getElementById('sun-ray'),
    panelTiltGroup: document.getElementById('panel-tilt-group'),
    valAzPos: document.getElementById('val-az-pos'),
    valElPos: document.getElementById('val-el-pos'),
    valAzSun: document.getElementById('val-az-sun'),
    valElSun: document.getElementById('val-el-sun'),

    // Sensor de 4 Cuadrantes
    valLightAvg: document.getElementById('val-light-avg'),
    valLdrTL: document.getElementById('val-ldr-tl'),
    valLdrTR: document.getElementById('val-ldr-tr'),
    valLdrBL: document.getElementById('val-ldr-bl'),
    valLdrBR: document.getElementById('val-ldr-br'),
    barLdrTL: document.getElementById('bar-ldr-tl'),
    barLdrTR: document.getElementById('bar-ldr-tr'),
    barLdrBL: document.getElementById('bar-ldr-bl'),
    barLdrBR: document.getElementById('bar-ldr-br'),
    valErrAz: document.getElementById('val-err-az'),
    valErrEl: document.getElementById('val-err-el'),
    pointerErrAz: document.getElementById('pointer-err-az'),
    pointerErrEl: document.getElementById('pointer-err-el'),

    // Botones de Mando
    btnModeAuto: document.getElementById('btn-mode-auto'),
    btnModePark: document.getElementById('btn-mode-park'),
    btnModeStow: document.getElementById('btn-mode-stow'),
    btnModeStop: document.getElementById('btn-mode-stop'),
    btnModeReset: document.getElementById('btn-mode-reset'),
    btnEmergencyToggle: document.getElementById('btn-emergency-toggle'),

    // Sliders de Ambiente
    sliderSunAz: document.getElementById('slider-sun-az'),
    sliderSunEl: document.getElementById('slider-sun-el'),
    sliderLux: document.getElementById('slider-lux'),
    sliderWind: document.getElementById('slider-wind'),
    lblSliderSunAz: document.getElementById('lbl-slider-sun-az'),
    lblSliderSunEl: document.getElementById('lbl-slider-sun-el'),
    lblSliderLux: document.getElementById('lbl-slider-lux'),
    lblSliderWind: document.getElementById('lbl-slider-wind'),

    // Pestaña Efemérides
    selectLocationPreset: document.getElementById('select-location-preset'),
    inputLat: document.getElementById('input-lat'),
    inputLon: document.getElementById('input-lon'),
    inputUtcOffset: document.getElementById('input-utc-offset'),
    inputDate: document.getElementById('input-date'),
    inputTime: document.getElementById('input-time'),
    btnToggleLiveTime: document.getElementById('btn-toggle-live-time'),
    lblLiveTimeMode: document.getElementById('lbl-live-time-mode'),
    btnLinkSunToSim: document.getElementById('btn-link-sun-to-sim'),
    badgeHorizonStatus: document.getElementById('badge-horizon-status'),
    ephElevation: document.getElementById('eph-elevation'),
    ephAzimuth: document.getElementById('eph-azimuth'),
    ephZenith: document.getElementById('eph-zenith'),
    ephDeclination: document.getElementById('eph-declination'),
    ephEot: document.getElementById('eph-eot'),
    ephHourAngle: document.getElementById('eph-hour-angle'),

    // Pestaña Rendimiento
    svgEnergyChart: document.getElementById('svg-energy-chart'),
    metricDualKWh: document.getElementById('metric-dual-kwh'),
    metricFixedKWh: document.getElementById('metric-fixed-kwh'),
    metricGainPercent: document.getElementById('metric-gain-percent'),
    lblFixedTiltDesc: document.getElementById('lbl-fixed-tilt-desc'),

    // Pestaña Terminal Serie
    termOutput: document.getElementById('term-output'),
    termInput: document.getElementById('term-input'),
    btnTermSend: document.getElementById('btn-term-send'),
    btnTermClear: document.getElementById('btn-term-clear'),
    btnTermStatus: document.getElementById('btn-term-status'),
    btnTermHelp: document.getElementById('btn-term-help'),
    btnTermAuto: document.getElementById('btn-term-auto'),
    btnTermPark: document.getElementById('btn-term-park'),
    btnTermStow: document.getElementById('btn-term-stow'),
    btnTermStop: document.getElementById('btn-term-stop'),
    btnTermReset: document.getElementById('btn-term-reset'),

    // Pestaña Sketch C++
    cfgPinTL: document.getElementById('cfg-pin-tl'),
    cfgPinTR: document.getElementById('cfg-pin-tr'),
    cfgPinBL: document.getElementById('cfg-pin-bl'),
    cfgPinBR: document.getElementById('cfg-pin-br'),
    cfgPinServoAz: document.getElementById('cfg-pin-servo-az'),
    cfgPinServoEl: document.getElementById('cfg-pin-servo-el'),
    btnUpdateSketch: document.getElementById('btn-update-sketch'),
    btnCopySketch: document.getElementById('btn-copy-sketch'),
    codeSketchPreview: document.getElementById('code-sketch-preview')
  };

  // =========================================================================
  // 3. Manejo de Pestañas
  // =========================================================================
  dom.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      dom.tabBtns.forEach(b => b.classList.remove('active'));
      dom.tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');

      if (targetId === 'tab-energy') {
        renderEnergyChart();
      }
    });
  });

  // =========================================================================
  // 4. Controles del Simulador y Botones de Modo
  // =========================================================================
  dom.btnModeAuto.addEventListener('click', () => {
    serialConsole.execute('AUTO');
    updateButtonsState();
  });

  dom.btnModePark.addEventListener('click', () => {
    serialConsole.execute('PARK');
    updateButtonsState();
  });

  dom.btnModeStow.addEventListener('click', () => {
    serialConsole.execute('STOW');
    updateButtonsState();
  });

  dom.btnModeStop.addEventListener('click', () => {
    serialConsole.execute('STOP');
    updateButtonsState();
  });

  dom.btnModeReset.addEventListener('click', () => {
    serialConsole.execute('RESET');
    updateButtonsState();
  });

  dom.btnEmergencyToggle.addEventListener('click', () => {
    sim.safety.emergencyStop = !sim.safety.emergencyStop;
    if (sim.safety.emergencyStop) {
      dom.btnEmergencyToggle.textContent = 'E-STOP: ACTIVA';
      dom.btnEmergencyToggle.style.backgroundColor = 'var(--alert-ruby)';
      dom.btnEmergencyToggle.style.color = '#fff';
      printTerminalLine('ALERTA: Parada de emergencia activada físicamente', 'term-line-err');
    } else {
      dom.btnEmergencyToggle.textContent = 'E-STOP: OFF';
      dom.btnEmergencyToggle.style.backgroundColor = 'rgba(244, 63, 94, 0.15)';
      dom.btnEmergencyToggle.style.color = 'var(--alert-ruby)';
      printTerminalLine('Parada de emergencia liberada. Ejecute RESET para reanudar.', 'term-line-sys');
    }
  });

  function updateButtonsState() {
    dom.btnModeAuto.classList.toggle('btn-primary', sim.mode === Helios.OperatingMode.AUTOMATIC);
    dom.btnModePark.classList.toggle('btn-primary', sim.mode === Helios.OperatingMode.PARK);
    dom.btnModeStow.classList.toggle('btn-primary', sim.mode === Helios.OperatingMode.STOW);
    dom.btnModeStop.classList.toggle('btn-primary', sim.mode === Helios.OperatingMode.STOPPED);
  }

  // Sliders de Ambiente
  dom.sliderSunAz.addEventListener('input', (e) => {
    linkedSunToAstronomical = false;
    environment.sunAzimuth = parseFloat(e.target.value);
    dom.lblSliderSunAz.textContent = `${environment.sunAzimuth.toFixed(0)}°`;
  });

  dom.sliderSunEl.addEventListener('input', (e) => {
    linkedSunToAstronomical = false;
    environment.sunElevation = parseFloat(e.target.value);
    dom.lblSliderSunEl.textContent = `${environment.sunElevation.toFixed(0)}°`;
  });

  dom.sliderLux.addEventListener('input', (e) => {
    environment.irradianceDNI = parseFloat(e.target.value);
    dom.lblSliderLux.textContent = `${environment.irradianceDNI} W/m²`;
  });

  dom.sliderWind.addEventListener('input', (e) => {
    environment.windSpeedKmH = parseFloat(e.target.value);
    dom.lblSliderWind.textContent = `${environment.windSpeedKmH} km/h`;
    sim.safety.wind = environment.windSpeedKmH > 45;
  });

  // =========================================================================
  // 5. Bucle de Simulación Principal (Simulation Loop)
  // =========================================================================
  function simulationLoop(now) {
    const deltaMs = Math.min(now - lastFrameTime, 100);
    lastFrameTime = now;

    // Si el sol está vinculado a las efemérides astronómicas, actualizarlo en vivo
    if (linkedSunToAstronomical) {
      const eph = getCalculatedEphemeris();
      if (eph && eph.valid) {
        environment.sunAzimuth = eph.azimuthDegrees;
        environment.sunElevation = eph.elevationDegrees;
        dom.sliderSunAz.value = clamp(Math.round(eph.azimuthDegrees), 10, 170);
        dom.lblSliderSunAz.textContent = `${eph.azimuthDegrees.toFixed(1)}°`;
        dom.sliderSunEl.value = Math.round(eph.elevationDegrees);
        dom.lblSliderSunEl.textContent = `${eph.elevationDegrees.toFixed(1)}°`;
      }
    }

    // Calcular lecturas de los 4 LDRs a partir de la óptica del baffle en cruz
    const opticalReadings = sim.calculateOpticalQuadrantReadings(
      environment.sunAzimuth,
      environment.sunElevation,
      environment.irradianceDNI,
      80
    );

    // Actualizar física del simulador
    sim.update(deltaMs, { light: opticalReadings });

    // Renderizar estado en pantalla
    renderWorkbenchState();

    requestAnimationFrame(simulationLoop);
  }

  function renderWorkbenchState() {
    const s = sim.getStatus();

    // 1. Píldoras de Telemetría Superior
    dom.pillModeText.textContent = s.mode;
    dom.pillStateText.textContent = s.state;
    dom.pillAzText.textContent = `${s.azimuthPosition.toFixed(1)}°`;
    dom.pillElText.textContent = `${s.elevationPosition.toFixed(1)}°`;

    if (s.state === Helios.ControllerState.FAULT) {
      dom.dotState.className = 'pill-dot ruby';
      dom.badgeControllerState.className = 'badge-state fault';
      dom.badgeControllerState.textContent = `FALLA (0x${s.faults.toString(16).toUpperCase()})`;
    } else if (s.state === Helios.ControllerState.WIND_STOW) {
      dom.dotState.className = 'pill-dot amber';
      dom.badgeControllerState.className = 'badge-state stow';
      dom.badgeControllerState.textContent = 'RESGUARDO VIENTO';
    } else if (s.state === Helios.ControllerState.NIGHT_PARK || s.state === Helios.ControllerState.PARKED) {
      dom.dotState.className = 'pill-dot active';
      dom.badgeControllerState.className = 'badge-state park';
      dom.badgeControllerState.textContent = 'ESTACIONADO';
    } else {
      dom.dotState.className = 'pill-dot active';
      dom.badgeControllerState.className = 'badge-state';
      dom.badgeControllerState.textContent = s.state;
    }

    // 2. Valores numéricos de la orientación
    dom.valAzPos.innerHTML = `${s.azimuthPosition.toFixed(1)}<span class="readout-unit">°</span>`;
    dom.valElPos.innerHTML = `${s.elevationPosition.toFixed(1)}<span class="readout-unit">°</span>`;
    dom.valAzSun.innerHTML = `${environment.sunAzimuth.toFixed(1)}<span class="readout-unit">°</span>`;
    dom.valElSun.innerHTML = `${environment.sunElevation.toFixed(1)}<span class="readout-unit">°</span>`;

    // 3. Gráficos SVG del Seguidor
    // Posición del Sol en la bóveda (X entre 50 y 550, Y entre 50 y 270)
    const azNorm = clamp((environment.sunAzimuth - 10) / 160.0, 0.0, 1.0); // Rango de seguidor ~10 a 170°
    const sunX = 50 + azNorm * 500;
    const elNorm = clamp(environment.sunElevation / 90.0, 0.0, 1.0);
    const sunY = 270 - elNorm * 210;

    dom.sunGroup.setAttribute('transform', `translate(${sunX}, ${sunY})`);

    // Inclinación del panel fotovoltaico (-90 a 0 grados en SVG)
    // Cuando elevación es 20° -> gira -20°
    const panelAngle = -s.elevationPosition;
    dom.panelTiltGroup.setAttribute('transform', `translate(0, -30) rotate(${panelAngle})`);

    // Rayo solar hacia el panel
    dom.sunRay.setAttribute('x1', '0');
    dom.sunRay.setAttribute('y1', '0');
    dom.sunRay.setAttribute('x2', `${300 - sunX}`);
    dom.sunRay.setAttribute('y2', `${240 - sunY}`);

    // 4. Sensor de 4 Cuadrantes
    dom.valLightAvg.textContent = s.light.average;
    dom.valLdrTL.textContent = s.light.topLeft;
    dom.valLdrTR.textContent = s.light.topRight;
    dom.valLdrBL.textContent = s.light.bottomLeft;
    dom.valLdrBR.textContent = s.light.bottomRight;

    dom.barLdrTL.style.width = `${clamp(s.light.topLeft / 10.23, 0, 100)}%`;
    dom.barLdrTR.style.width = `${clamp(s.light.topRight / 10.23, 0, 100)}%`;
    dom.barLdrBL.style.width = `${clamp(s.light.bottomLeft / 10.23, 0, 100)}%`;
    dom.barLdrBR.style.width = `${clamp(s.light.bottomRight / 10.23, 0, 100)}%`;

    // Medidores de Error
    dom.valErrAz.textContent = `${s.azimuthErrorPercent > 0 ? '+' : ''}${s.azimuthErrorPercent}%`;
    dom.valErrEl.textContent = `${s.elevationErrorPercent > 0 ? '+' : ''}${s.elevationErrorPercent}%`;

    const pointerAzX = 50 + (s.azimuthErrorPercent / 2.0);
    dom.pointerErrAz.style.left = `${clamp(pointerAzX, 2, 98)}%`;

    const pointerElX = 50 + (s.elevationErrorPercent / 2.0);
    dom.pointerErrEl.style.left = `${clamp(pointerElX, 2, 98)}%`;
  }

  // =========================================================================
  // 6. Efemérides Solares (Pestaña 2)
  // =========================================================================
  dom.selectLocationPreset.addEventListener('change', () => {
    const val = dom.selectLocationPreset.value;
    if (val === 'CUSTOM') return;
    const preset = Helios.LocationPresets[val];
    if (preset) {
      dom.inputLat.value = preset.latitude;
      dom.inputLon.value = preset.longitude;
      dom.inputUtcOffset.value = preset.utcOffsetMinutes;
      updateEphemerisDisplay();
    }
  });

  [dom.inputLat, dom.inputLon, dom.inputUtcOffset, dom.inputDate, dom.inputTime].forEach(input => {
    input.addEventListener('input', () => {
      dom.selectLocationPreset.value = 'CUSTOM';
      updateEphemerisDisplay();
    });
  });

  dom.btnToggleLiveTime.addEventListener('click', () => {
    liveTimeActive = !liveTimeActive;
    if (liveTimeActive) {
      dom.btnToggleLiveTime.textContent = 'Detener Hora';
      dom.btnToggleLiveTime.classList.add('btn-primary');
      dom.lblLiveTimeMode.textContent = '(En vivo)';
      syncTimeToNow();
      liveTimeTimer = setInterval(syncTimeToNow, 1000);
    } else {
      dom.btnToggleLiveTime.textContent = 'Hora Actual';
      dom.btnToggleLiveTime.classList.remove('btn-primary');
      dom.lblLiveTimeMode.textContent = '';
      clearInterval(liveTimeTimer);
    }
  });

  function syncTimeToNow() {
    const now = new Date();
    dom.inputDate.value = now.toISOString().slice(0, 10);
    dom.inputTime.value = now.toTimeString().slice(0, 8);
    updateEphemerisDisplay();
  }

  function getCalculatedEphemeris() {
    const dateParts = dom.inputDate.value.split('-').map(Number);
    const timeParts = dom.inputTime.value.split(':').map(Number);
    const localTime = {
      year: dateParts[0] || 2026,
      month: dateParts[1] || 1,
      day: dateParts[2] || 15,
      hour: timeParts[0] || 12,
      minute: timeParts[1] || 0,
      second: timeParts[2] || 0
    };
    const location = {
      latitudeDegrees: parseFloat(dom.inputLat.value) || -34.9214,
      longitudeDegrees: parseFloat(dom.inputLon.value) || -57.9544,
      utcOffsetMinutes: parseInt(dom.inputUtcOffset.value, 10) || -180
    };

    return Helios.SolarCalculator.calculate(localTime, location);
  }

  function updateEphemerisDisplay() {
    const eph = getCalculatedEphemeris();
    if (!eph || !eph.valid) return;

    dom.ephElevation.innerHTML = `${eph.elevationDegrees.toFixed(2)}<span class="readout-unit">°</span>`;
    dom.ephAzimuth.innerHTML = `${eph.azimuthDegrees.toFixed(2)}<span class="readout-unit">°</span>`;
    dom.ephZenith.innerHTML = `${eph.zenithDegrees.toFixed(2)}<span class="readout-unit">°</span>`;
    dom.ephDeclination.innerHTML = `${eph.declinationDegrees.toFixed(2)}<span class="readout-unit">°</span>`;
    dom.ephEot.innerHTML = `${eph.equationOfTimeMinutes.toFixed(1)}<span class="readout-unit"> min</span>`;
    dom.ephHourAngle.innerHTML = `${eph.hourAngleDegrees.toFixed(1)}<span class="readout-unit">°</span>`;

    if (eph.aboveHorizon) {
      dom.badgeHorizonStatus.textContent = 'SOBRE EL HORIZONTE (DÍA)';
      dom.badgeHorizonStatus.style.color = 'var(--status-emerald)';
      dom.badgeHorizonStatus.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    } else {
      dom.badgeHorizonStatus.textContent = 'BAJO EL HORIZONTE (NOCHE)';
      dom.badgeHorizonStatus.style.color = 'var(--text-dim)';
      dom.badgeHorizonStatus.style.borderColor = 'var(--border-subtle)';
    }
  }

  dom.btnLinkSunToSim.addEventListener('click', () => {
    linkedSunToAstronomical = true;
    updateEphemerisDisplay();
    // Cambiar a la pestaña de mesa de control para ver el efecto
    document.querySelector('.tab-btn[data-tab="tab-workbench"]').click();
    printTerminalLine('Posición del Sol vinculada al cálculo astronómico en tiempo real.', 'term-line-sys');
  });

  // =========================================================================
  // 7. Gráfico de Rendimiento Energético 24h (Pestaña 3)
  // =========================================================================
  function renderEnergyChart() {
    const dateParts = dom.inputDate.value.split('-').map(Number);
    const date = {
      year: dateParts[0] || 2026,
      month: dateParts[1] || 1,
      day: dateParts[2] || 15
    };
    const location = {
      latitudeDegrees: parseFloat(dom.inputLat.value) || -34.9214,
      longitudeDegrees: parseFloat(dom.inputLon.value) || -57.9544,
      utcOffsetMinutes: parseInt(dom.inputUtcOffset.value, 10) || -180
    };

    const yieldData = Helios.EnergyYieldCalculator.calculateDailyYield(date, location, 1.6, 20.0);

    dom.metricDualKWh.innerHTML = `${yieldData.yieldKWh.dualAxis.toFixed(3)} <span style="font-size: 0.85rem; font-weight: normal;">kWh/día</span>`;
    dom.metricFixedKWh.innerHTML = `${yieldData.yieldKWh.fixedOptimum.toFixed(3)} <span style="font-size: 0.85rem; font-weight: normal;">kWh/día</span>`;
    dom.metricGainPercent.textContent = `+${yieldData.gainOverFixedOptPercent}%`;
    dom.pillGainText.textContent = `+${yieldData.gainOverFixedOptPercent}%`;

    const cardinal = location.latitudeDegrees < 0 ? 'Norte' : 'Sur';
    dom.lblFixedTiltDesc.textContent = `Inclinación fija = ${yieldData.optTiltDegrees.toFixed(1)}° orientada al ${cardinal}`;

    // Construcción del SVG
    const svg = dom.svgEnergyChart;
    svg.innerHTML = '';

    const width = 800;
    const height = 240;
    const padX = 50;
    const padY = 30;
    const chartW = width - 2 * padX;
    const chartH = height - 2 * padY;

    // Escala máxima de potencia en Watts
    let maxPower = 350;
    yieldData.hours.forEach(h => {
      if (h.powerDualWatts > maxPower) maxPower = h.powerDualWatts;
    });
    maxPower = Math.ceil(maxPower / 50) * 50;

    // Líneas de cuadrícula horizontal
    for (let p = 0; p <= maxPower; p += 100) {
      const y = padY + chartH - (p / maxPower) * chartH;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', padX);
      line.setAttribute('y1', y);
      line.setAttribute('x2', width - padX);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(255,255,255,0.08)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', padX - 8);
      label.setAttribute('y', y + 4);
      label.setAttribute('fill', '#64748b');
      label.setAttribute('font-size', '10');
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-family', 'monospace');
      label.textContent = `${p}W`;
      svg.appendChild(label);
    }

    // Puntos de curvas
    const ptsDual = [];
    const ptsFixed = [];
    const ptsFlat = [];

    yieldData.hours.forEach((h, idx) => {
      const x = padX + (idx / 23) * chartW;
      const yDual = padY + chartH - (h.powerDualWatts / maxPower) * chartH;
      const yFixed = padY + chartH - (h.powerFixedOptWatts / maxPower) * chartH;
      const yFlat = padY + chartH - (h.powerFixedFlatWatts / maxPower) * chartH;

      ptsDual.push(`${x},${yDual}`);
      ptsFixed.push(`${x},${yFixed}`);
      ptsFlat.push(`${x},${yFlat}`);

      // Etiquetas de horas cada 3h
      if (h.hour % 3 === 0) {
        const timeLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        timeLabel.setAttribute('x', x);
        timeLabel.setAttribute('y', height - 8);
        timeLabel.setAttribute('fill', '#64748b');
        timeLabel.setAttribute('font-size', '10');
        timeLabel.setAttribute('text-anchor', 'middle');
        timeLabel.setAttribute('font-family', 'monospace');
        timeLabel.textContent = `${h.hour}:00`;
        svg.appendChild(timeLabel);
      }
    });

    // Área bajo la curva Dual
    const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const areaPts = [`${padX},${padY + chartH}`, ...ptsDual, `${padX + chartW},${padY + chartH}`].join(' ');
    areaPath.setAttribute('points', areaPts);
    areaPath.setAttribute('fill', 'rgba(245, 158, 11, 0.12)');
    svg.appendChild(areaPath);

    // Curva Fijo Plano (Gris)
    const polyFlat = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyFlat.setAttribute('points', ptsFlat.join(' '));
    polyFlat.setAttribute('fill', 'none');
    polyFlat.setAttribute('stroke', '#475569');
    polyFlat.setAttribute('stroke-width', '1.5');
    polyFlat.setAttribute('stroke-dasharray', '3 3');
    svg.appendChild(polyFlat);

    // Curva Fijo Óptimo (Cian)
    const polyFixed = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyFixed.setAttribute('points', ptsFixed.join(' '));
    polyFixed.setAttribute('fill', 'none');
    polyFixed.setAttribute('stroke', '#38bdf8');
    polyFixed.setAttribute('stroke-width', '2');
    svg.appendChild(polyFixed);

    // Curva Seguidor Dual (Dorado brillante)
    const polyDual = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyDual.setAttribute('points', ptsDual.join(' '));
    polyDual.setAttribute('fill', 'none');
    polyDual.setAttribute('stroke', '#f59e0b');
    polyDual.setAttribute('stroke-width', '2.5');
    svg.appendChild(polyDual);
  }

  // =========================================================================
  // 8. Consola y Protocolo Serie
  // =========================================================================
  function printTerminalLine(text, cssClass) {
    const line = document.createElement('div');
    if (cssClass) line.className = cssClass;
    line.textContent = text;
    dom.termOutput.appendChild(line);
    dom.termOutput.scrollTop = dom.termOutput.scrollHeight;
  }

  function sendTerminalCommand(cmdText) {
    if (!cmdText) return;
    printTerminalLine(`> ${cmdText}`, 'term-line-in');
    const response = serialConsole.execute(cmdText);
    if (response) {
      const lines = response.split('\r\n');
      lines.forEach(l => {
        let cls = 'term-line-sys';
        if (l.startsWith('OK')) cls = 'term-line-ok';
        if (l.startsWith('ERROR')) cls = 'term-line-err';
        printTerminalLine(l, cls);
      });
    }
  }

  dom.btnTermSend.addEventListener('click', () => {
    const cmd = dom.termInput.value.trim();
    if (cmd) {
      sendTerminalCommand(cmd);
      dom.termInput.value = '';
    }
  });

  dom.termInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cmd = dom.termInput.value.trim();
      if (cmd) {
        sendTerminalCommand(cmd);
        dom.termInput.value = '';
      }
    }
  });

  dom.btnTermClear.addEventListener('click', () => {
    dom.termOutput.innerHTML = '';
  });

  dom.btnTermStatus.addEventListener('click', () => sendTerminalCommand('STATUS'));
  dom.btnTermHelp.addEventListener('click', () => sendTerminalCommand('HELP'));
  dom.btnTermAuto.addEventListener('click', () => sendTerminalCommand('AUTO'));
  dom.btnTermPark.addEventListener('click', () => sendTerminalCommand('PARK'));
  dom.btnTermStow.addEventListener('click', () => sendTerminalCommand('STOW'));
  dom.btnTermStop.addEventListener('click', () => sendTerminalCommand('STOP'));
  dom.btnTermReset.addEventListener('click', () => sendTerminalCommand('RESET'));

  // =========================================================================
  // 9. Generador de Sketch Arduino C++
  // =========================================================================
  function updateSketchCode() {
    const pinout = {
      ldrTopLeft: dom.cfgPinTL.value.trim() || 'A0',
      ldrTopRight: dom.cfgPinTR.value.trim() || 'A1',
      ldrBottomLeft: dom.cfgPinBL.value.trim() || 'A2',
      ldrBottomRight: dom.cfgPinBR.value.trim() || 'A3',
      servoAzimuth: parseInt(dom.cfgPinServoAz.value, 10) || 9,
      servoElevation: parseInt(dom.cfgPinServoEl.value, 10) || 10
    };

    const code = Helios.generateArduinoSketch(sim.config, pinout);
    dom.codeSketchPreview.textContent = code;
  }

  dom.btnUpdateSketch.addEventListener('click', updateSketchCode);

  dom.btnCopySketch.addEventListener('click', () => {
    navigator.clipboard.writeText(dom.codeSketchPreview.textContent).then(() => {
      dom.btnCopySketch.textContent = '¡Copiado!';
      setTimeout(() => {
        dom.btnCopySketch.textContent = 'Copiar al Portapapeles';
      }, 2000);
    });
  });

  // =========================================================================
  // 10. Inicialización al Cargar la Página
  // =========================================================================
  updateEphemerisDisplay();
  renderEnergyChart();
  updateSketchCode();
  requestAnimationFrame(simulationLoop);

})();
