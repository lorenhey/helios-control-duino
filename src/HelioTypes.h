#ifndef HELIO_CONTROL_DUINO_TYPES_H
#define HELIO_CONTROL_DUINO_TYPES_H

#include <Arduino.h>

namespace heliocontrol {

static const int8_t PIN_UNUSED = -1;
static const char VERSION[] = "2.0.0";

enum class OperatingMode : uint8_t {
  AUTOMATIC,
  PARK,
  STOW,
  MANUAL,
  STOPPED
};

enum class ControllerState : uint8_t {
  STARTING,
  TRACKING,
  WAITING_FOR_LIGHT,
  NIGHT_PARK,
  PARKED,
  WIND_STOW,
  MANUAL,
  STOPPED,
  FAULT
};

enum Fault : uint8_t {
  FAULT_NONE = 0,
  FAULT_INVALID_CONFIG = 1 << 0,
  FAULT_SENSOR = 1 << 1,
  FAULT_EMERGENCY = 1 << 2,
  FAULT_LIMIT_CONFLICT = 1 << 3,
  FAULT_AXIS = 1 << 4,
  FAULT_SAFETY_INPUT = 1 << 5
};

struct AxisConfig {
  float minimumAngle;
  float maximumAngle;
  float parkAngle;
  float stowAngle;
  float initialAngle;
  float maximumSpeedDegreesPerSecond;
};

struct TrackingConfig {
  uint16_t darknessThreshold;
  uint8_t deadbandPercent;
  float stepDegrees;
  int8_t azimuthDirection;
  int8_t elevationDirection;
  uint32_t updateIntervalMs;
  uint32_t darknessDelayMs;
  uint32_t lightRecoveryDelayMs;
  uint32_t windRecoveryDelayMs;
};

struct ControllerConfig {
  AxisConfig azimuth;
  AxisConfig elevation;
  TrackingConfig tracking;
};

struct LightReading {
  uint16_t topLeft;
  uint16_t topRight;
  uint16_t bottomLeft;
  uint16_t bottomRight;
  uint16_t average;
};

struct SafetyStatus {
  bool wind;
  bool emergencyStop;
  bool azimuthMinimum;
  bool azimuthMaximum;
  bool elevationMinimum;
  bool elevationMaximum;
};

struct ControllerStatus {
  OperatingMode mode;
  ControllerState state;
  uint8_t faults;
  float azimuthPosition;
  float elevationPosition;
  float azimuthTarget;
  float elevationTarget;
  int16_t azimuthErrorPercent;
  int16_t elevationErrorPercent;
  LightReading light;
  SafetyStatus safety;
  uint32_t updateCount;
};

ControllerConfig defaultControllerConfig();
const __FlashStringHelper *modeName(OperatingMode mode);
const __FlashStringHelper *stateName(ControllerState state);

}  // namespace heliocontrol

#endif
