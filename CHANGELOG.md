# Historial de cambios

## 2.0.0 - 2026-10-26

- **Mesa de Control Interactiva (Workbench Web)**: Aplicación web 100% offline desplegada en GitHub Pages (`https://lorenhey.github.io/helios-control-duino/`).
- **Visualizador 2D/3D del Seguidor**: Gráficos SVG en tiempo real con proyección de bóveda celeste, vector normal del panel $\vec{n}$, vector solar $\vec{s}$ y rayo de incidencia.
- **Sensor Óptico de 4 Cuadrantes**: Modelado de sombra por separador en cruz con barras de lux y medidores de error normalizado con umbrales de zona muerta (deadband).
- **Simulador de Máquina de Estados**: Control de modos (`AUTO`, `PARK`, `STOW`, `MANUAL`, `STOP`, `RESET`), parada de emergencia (E-STOP) y umbral de viento.
- **Cálculo Astronómico Meeus (SolarCalculator)**: Calculador offline de coordenadas solares con presets geográficos (La Plata, Buenos Aires, Córdoba, Atacama, Madrid, Ecuador Solar), declinación, ecuación del tiempo y vinculación en vivo al seguidor.
- **Modelo de Rendimiento Energético**: Curva horaria de 24 horas comparativa entre seguidor de dos ejes (Dual-Axis) y panel fijo con inclinación óptima (+25% a +57% de ganancia según estación).
- **Monitor Serie Virtual**: Emulador interactivo de comandos a 115200 baudios idéntico a `HelioSerial.cpp`.
- **Generador de Sketch C++**: Configuración interactiva de pines y exportación de firmware compilable listo para Arduino IDE.
- **Suites de Pruebas Automatizadas**: 8 pruebas unitarias en Node.js (`test_helios_engine.js`) y 3 en Python (`test_helios_engine.py`) integradas en CI/CD con GitHub Actions.

## 1.0.0 - 2026-08-10

- Biblioteca Arduino con controlador no bloqueante de dos ejes.
- Seguimiento diferencial mediante cuatro LDR con filtrado y zona muerta.
- Estacionamiento nocturno y resguardo por viento.
- Entradas opcionales de emergencia y finales de carrera.
- Control gradual de servos y límites configurables.
- Consola serie para operación y diagnóstico.
- Cálculo offline de azimut y elevación solar.
- Firmware de referencia, ejemplos, documentación y validación automática.
