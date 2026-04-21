from fastapi import APIRouter
from core.kmeans_model import ejecutar_clustering_logistico, ejecutar_clustering_terreno

router = APIRouter()

@router.get("/logistica_inteligente")
async def get_logistica():
    pedidos = [
        [27.3680, -109.9320], [27.3695, -109.9315], [27.3675, -109.9330],
        [27.3750, -109.9450], [27.3765, -109.9465], [27.3740, -109.9440],
        [27.3550, -109.9200], [27.3565, -109.9215], [27.3540, -109.9190]
    ]
    centros, puntos = ejecutar_clustering_logistico(pedidos)
    return {"status": "success", "puntos_demanda": puntos, "almacenes_sugeridos": centros}

@router.get("/zonas_manejo")
async def get_zonas():
    datos = [[12.5, 0.25], [22.1, 0.65], [32.0, 0.88]] # Simplificado para el ejemplo
    centros = ejecutar_clustering_terreno(datos)
    return {"status": "success", "centros": centros}