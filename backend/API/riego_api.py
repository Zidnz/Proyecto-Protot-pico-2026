"""
riego_api.py — Endpoints de riego y balance hídrico para MILPÍN AgTech v2.0

Expone los cálculos del motor agronómico FAO-56 como API REST.
El prefijo /api es agregado por main.py al registrar el router.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException

from core.balance_hidrico import (
    calcular_balance_hidrico,
    calcular_costo_riego,
    calcular_eto_hargreaves,
    calcular_eto_penman_monteith,
    obtener_curva_kc,
    obtener_kc,
)

router = APIRouter()


@router.get("/balance_hidrico")
async def get_balance_hidrico(
    parcela_id: str,
    cultivo: str,
    dias_siembra: int,
    tmax: float,
    tmin: float,
    humedad_rel: Optional[float] = None,
    viento: Optional[float] = None,
    radiacion: Optional[float] = None,
    precipitacion: float = 0.0,
    humedad_suelo: float = 30.0,
    capacidad_campo: float = 38.0,
    punto_marchitez: float = 18.0,
    profundidad_raiz: float = 0.6,
):
    """Calcula el balance hídrico completo para una parcela.

    Si se proporcionan humedad_rel, viento y radiacion se usa FAO-56
    Penman-Monteith. En caso contrario, se recurre a Hargreaves como
    método de respaldo y se incluye una advertencia en la respuesta.
    """
    # Día del año actual para cálculos de radiación
    dia_del_ano = date.today().timetuple().tm_yday

    # Selección del método de ETo
    metodo_eto = "penman_monteith"
    advertencia = None

    if humedad_rel is not None and viento is not None and radiacion is not None:
        eto = calcular_eto_penman_monteith(
            tmax=tmax,
            tmin=tmin,
            humedad_rel=humedad_rel,
            viento_ms=viento,
            radiacion_solar_mj=radiacion,
            dia_del_ano=dia_del_ano,
        )
    else:
        metodo_eto = "hargreaves"
        advertencia = (
            "Datos incompletos (humedad, viento o radiación faltantes). "
            "Se usó el método de Hargreaves como respaldo. "
            "Para mayor precisión, proporcione todos los parámetros climáticos."
        )
        eto = calcular_eto_hargreaves(
            tmax=tmax,
            tmin=tmin,
            dia_del_ano=dia_del_ano,
        )

    # Coeficiente de cultivo Kc (FAO-56)
    try:
        kc = obtener_kc(cultivo, dias_siembra)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Evapotranspiración del cultivo ETc = ETo * Kc
    etc = eto * kc

    # Balance hídrico
    balance = calcular_balance_hidrico(
        etc_mm=etc,
        precipitacion_mm=precipitacion,
        humedad_actual_pct=humedad_suelo,
        capacidad_campo_pct=capacidad_campo,
        punto_marchitez_pct=punto_marchitez,
        profundidad_raiz_m=profundidad_raiz,
    )

    # Costo de riego (solo si se requiere riego)
    costo = calcular_costo_riego(volumen_m3=balance["volumen_m3_ha"])

    # Respuesta
    resultado = {
        "parcela_id": parcela_id,
        "fecha_calculo": date.today().isoformat(),
        "metodo_eto": metodo_eto,
        "eto_mm": round(eto, 2),
        "kc": round(kc, 2),
        "etc_mm": round(etc, 2),
        "balance": balance,
        "costo": costo,
    }

    if advertencia:
        resultado["advertencia"] = advertencia

    return resultado


@router.get("/kc/{cultivo}")
async def get_curva_kc(cultivo: str):
    """Retorna la curva completa de Kc (todas las etapas fenológicas)
    para un cultivo dado, según FAO-56 Tabla 12."""
    try:
        curva = obtener_curva_kc(cultivo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return curva
