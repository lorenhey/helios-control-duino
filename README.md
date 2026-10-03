# HelioControlDuino

[![Verificación Arduino](https://github.com/lorenhey/HelioControlDuino/actions/workflows/ci.yml/badge.svg)](https://github.com/lorenhey/HelioControlDuino/actions/workflows/ci.yml)
[![Versión](https://img.shields.io/github/v/release/lorenhey/HelioControlDuino?display_name=tag)](https://github.com/lorenhey/HelioControlDuino/releases)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)

Controlador autónomo y configurable para seguidores solares construidos con
microcontroladores compatibles con Arduino. Funciona sin Internet ni servicios
en la nube y no requiere dependencias externas, salvo la biblioteca oficial
`Servo` incluida con el entorno Arduino.

El proyecto incluye una biblioteca reutilizable y un firmware de referencia
listo para un seguidor de dos ejes con:

- cuatro fotorresistencias (LDR) dispuestas en cuadrantes;
- dos servomotores, uno para azimut y otro para elevación;
- estacionamiento automático durante la noche;
- posición de resguardo ante viento;
- parada de emergencia y finales de carrera opcionales;
- movimientos graduales, sin pausas bloqueantes;
- control manual, diagnóstico y telemetría por puerto serie;
- cálculo astronómico de la posición solar, completamente offline.

## Puesta en marcha rápida

### Materiales

- Arduino Uno, Nano, Mega u otra placa compatible;
- 2 servomotores adecuados para la carga mecánica;
- 4 LDR y 4 resistencias de 10 kΩ;
- una fuente regulada independiente para los servos;
- cables y una estructura de seguimiento de dos ejes.

Los servos **no deben alimentarse desde el pin de 5 V del Arduino**. Utilizá
una fuente externa dimensionada para su corriente y conectá su masa con `GND`
del Arduino.

### Conexiones predeterminadas

| Elemento | Pin |
| --- | --- |
| LDR superior izquierda | A0 |
| LDR superior derecha | A1 |
| LDR inferior izquierda | A2 |
| LDR inferior derecha | A3 |
| Servo de azimut | 9 |
| Servo de elevación | 10 |
| LED de estado | LED_BUILTIN |

Las entradas de viento, parada y finales de carrera están deshabilitadas de
fábrica. En [docs/hardware.md](docs/hardware.md) se explica cómo conectarlas.

### Instalación

1. Descargá el repositorio como ZIP.
2. En Arduino IDE, elegí **Programa > Incluir Librería > Añadir biblioteca
   .ZIP**.
3. Abrí `Archivo > Ejemplos > HelioControlDuino > BasicDualAxis` para una
   prueba rápida, o `CompleteController` para usar el controlador completo.
4. Revisá `config.h`, seleccioná la placa y cargá el programa.
5. Abrí el monitor serie a **115200 baudios** y ejecutá `STATUS`.

Antes de acoplar los servos a la estructura, realizá la calibración indicada en
[docs/calibration.md](docs/calibration.md).

## Estructura

```text
src/                         Biblioteca Arduino
examples/BasicDualAxis/      Ejemplo mínimo con cuatro LDR y dos servos
examples/CompleteController/ Firmware completo y configurable
examples/SolarPosition/      Cálculo astronómico sin conexión
docs/                        Cableado, calibración, comandos y diseño
scripts/                     Comandos de validación local
test/host/                   Pruebas ejecutables de la lógica de control
```

## Cómo funciona

Un pequeño separador en cruz proyecta sombra sobre los cuatro LDR. El
controlador compara izquierda con derecha y arriba con abajo. Si la diferencia
normalizada supera la zona muerta configurada, desplaza el eje correspondiente
un paso. El filtrado y la limitación de velocidad evitan oscilaciones y picos de
corriente.

La máquina de estados da prioridad a la seguridad:

1. parada de emergencia;
2. resguardo por viento;
3. órdenes manuales de parada, estacionamiento o movimiento;
4. estacionamiento nocturno;
5. seguimiento automático.

## Consola serie

El firmware completo acepta órdenes terminadas en salto de línea:

```text
HELP
STATUS
AUTO
PARK
STOW
STOP
MOVE 90 45
RESET
```

La referencia completa está en [docs/serial-commands.md](docs/serial-commands.md).

## Compatibilidad

La biblioteca sigue el formato 1.5 de Arduino y utiliza solamente API comunes
de Arduino y `Servo`. El flujo de integración continua compila los ejemplos y
el firmware para Arduino Uno y Mega 2560.

Las arquitecturas declaradas coinciden con las que admite la biblioteca
oficial `Servo`: AVR, megaAVR, SAM, SAMD, nRF52, STM32F4, Mbed, Renesas y
Zephyr. La matriz de validación de referencia se ejecuta en Uno y Mega 2560.

## Seguridad

helios-control-duino es un controlador de referencia y no reemplaza protecciones
eléctricas o mecánicas independientes. Para instalaciones exteriores o paneles
de potencia significativa son obligatorios finales de carrera físicos,
protección contra sobrecorriente, puesta a tierra, resguardo por viento y una
parada de emergencia que corte la energía de los actuadores. No conectes un
motor de potencia directamente a un pin del microcontrolador.

## Licencia

Distribuido bajo la [Licencia MIT](LICENSE).

Las contribuciones son bienvenidas. Consultá [CONTRIBUTING.md](CONTRIBUTING.md)
para conocer el flujo de desarrollo y [SECURITY.md](SECURITY.md) para informar
problemas de seguridad de forma privada.
