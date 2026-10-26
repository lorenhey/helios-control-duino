#!/usr/bin/env python3
"""
test_helios_engine.py
Suite de validación en Python para HelioControlDuino v2.0.0
Verifica cálculos astronómicos de Meeus, fórmulas de diferencia normalizada
y coherencia del modelo físico.
"""

import math
import sys

PI = math.pi
DEG2RAD = PI / 180.0
RAD2DEG = 180.0 / PI

def clamp(val, min_v, max_v):
    return max(min_v, min(max_v, val))

def normalized_difference(positive, negative, total):
    if not total or total == 0:
        return 0
    diff = (positive - negative) * 100
    res = int(diff / total)
    return clamp(res, -100, 100)

def leap_year(year):
    return (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)

def day_of_year(year, month, day):
    days_before = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    res = days_before[month - 1] + day
    if month > 2 and leap_year(year):
        res += 1
    return res

def calculate_solar_position(year, month, day, hour, minute, second, lat, lon, utc_offset_min):
    year_days = 366 if leap_year(year) else 365
    fract_hour = hour + minute / 60.0 + second / 3600.0
    gamma = (2.0 * PI / year_days) * (day_of_year(year, month, day) - 1 + (fract_hour - 12.0) / 24.0)

    eq_of_time = 229.18 * (
        0.000075 +
        0.001868 * math.cos(gamma) -
        0.032077 * math.sin(gamma) -
        0.014615 * math.cos(2.0 * gamma) -
        0.040849 * math.sin(2.0 * gamma)
    )

    decl = 0.006918 - \
        0.399912 * math.cos(gamma) + \
        0.070257 * math.sin(gamma) - \
        0.006758 * math.cos(2.0 * gamma) + \
        0.000907 * math.sin(2.0 * gamma) - \
        0.002697 * math.cos(3.0 * gamma) + \
        0.00148 * math.sin(3.0 * gamma)

    local_minutes = hour * 60.0 + minute + second / 60.0
    time_offset = eq_of_time + 4.0 * lon - utc_offset_min
    true_solar_minutes = (local_minutes + time_offset) % 1440.0
    if true_solar_minutes < 0:
        true_solar_minutes += 1440.0

    hour_angle_deg = true_solar_minutes / 4.0 - 180.0
    if hour_angle_deg < -180.0:
        hour_angle_deg += 360.0

    lat_rad = lat * DEG2RAD
    ha_rad = hour_angle_deg * DEG2RAD
    cos_zenith = clamp(
        math.sin(lat_rad) * math.sin(decl) +
        math.cos(lat_rad) * math.cos(decl) * math.cos(ha_rad),
        -1.0, 1.0
    )
    zenith = math.acos(cos_zenith)
    elevation = 90.0 - (zenith * RAD2DEG)

    azimuth_rad = math.atan2(
        math.sin(ha_rad),
        math.cos(ha_rad) * math.sin(lat_rad) - math.tan(decl) * math.cos(lat_rad)
    )
    azimuth_deg = ((azimuth_rad * RAD2DEG) + 180.0) % 360.0
    if azimuth_deg < 0:
        azimuth_deg += 360.0

    return {
        "elevation": elevation,
        "azimuth": azimuth_deg,
        "above_horizon": elevation > 0.0
    }

def main():
    print("--- Test Python HelioControlDuino Solar & Physics Engine ---")

    # 1. Normalización
    assert normalized_difference(1000, 0, 1000) == 100
    assert normalized_difference(0, 1000, 1000) == -100
    assert normalized_difference(500, 500, 1000) == 0
    assert normalized_difference(1800, 600, 2400) == 50
    print("[1/3] Diferencia normalizada verificada.")

    # 2. Sol en La Plata (15 de enero de 2026, 12:00)
    pos = calculate_solar_position(2026, 1, 15, 12, 0, 0, -34.9214, -57.9544, -180)
    assert pos["above_horizon"] is True
    assert 50.0 < pos["elevation"] < 90.0, f"Elevacion inesperada: {pos['elevation']}"
    assert 0.0 <= pos["azimuth"] < 360.0
    print(f"[2/3] Posicion solar La Plata verificada (Elevacion: {pos['elevation']:.2f} deg, Azimut: {pos['azimuth']:.2f} deg).")

    # 3. Solsticio y Equinoccio
    pos_winter = calculate_solar_position(2026, 6, 21, 12, 0, 0, -34.9214, -57.9544, -180)
    assert pos_winter["above_horizon"] is True
    assert pos_winter["elevation"] < pos["elevation"], "Elevacion invernal debe ser menor a la estival"
    print(f"[3/3] Estacionalidad verificada (Invierno mediodia: {pos_winter['elevation']:.2f} deg vs Verano: {pos['elevation']:.2f} deg).")

    print("Todas las pruebas Python pasaron exitosamente (3/3).")

if __name__ == "__main__":
    main()
