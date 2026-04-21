// ==========================================
// map_engine.js: Motor Geoespacial Leaflet
// MILPÍN AgTech v2.0
//
// Arquitectura data-driven: todas las geometrías
// se cargan desde archivos GeoJSON en /data/.
// Cero coordenadas hardcodeadas.
// ==========================================

let map;
let mapaIniciado = false;

// ── Layer Groups (permiten toggle on/off en el control de capas) ─────
let capaLimites    = null;   // Polígono municipal de Cajeme
let capaLotes      = null;   // Parcelas agrícolas (NDVI / rendimiento)
let capaRios       = null;   // Red hidrográfica (ríos + arroyos)
let capaCanales    = null;   // Canales del Distrito de Riego 041
let capaPozos      = null;   // Pozos de extracción
let capaAnalisis   = null;   // Resultados dinámicos (clustering, etc.)

// ── Centro por defecto (Cajeme, Valle del Yaqui) ────────────────────
const DEFAULT_CENTER = [27.3670, -109.9310];
const DEFAULT_ZOOM   = 11;

// ── Paleta de colores NDVI / rendimiento ─────────────────────────────
function obtenerColorRendimiento(valor) {
    return valor > 90 ? '#006400' :
           valor > 75 ? '#228B22' :
           valor > 60 ? '#32CD32' :
           valor > 45 ? '#FFD700' :
           valor > 30 ? '#FF8C00' :
           valor > 15 ? '#FF4500' : '#8B0000';
}

// ── Estilos por tipo de capa ─────────────────────────────────────────
const ESTILOS = {
    limites: {
        color: '#3ee7ea',
        fillColor: '#3ee7ea',
        fillOpacity: 0.08,
        weight: 2.5,
        dashArray: '8, 6'
    },
    rio: {
        color: '#2980B9',
        weight: 5,
        opacity: 0.8,
        lineJoin: 'round'
    },
    arroyo: {
        color: '#5DADE2',
        weight: 2,
        opacity: 0.6,
        dashArray: '6, 4'
    },
    canal: {
        color: '#00E5FF',
        weight: 3,
        opacity: 0.8
    },
    pozo_activo: {
        radius: 6,
        fillColor: '#27AE60',
        color: '#1E8449',
        weight: 1.5,
        fillOpacity: 0.9
    },
    pozo_bajo: {
        radius: 6,
        fillColor: '#E67E22',
        color: '#D35400',
        weight: 1.5,
        fillOpacity: 0.9
    }
};

// ── Cargador genérico de GeoJSON ─────────────────────────────────────
// Retorna null si el archivo no existe (graceful degradation).

async function cargarGeoJSON(ruta) {
    try {
        const response = await fetch(ruta);
        if (!response.ok) {
            console.warn(`[GIS] ${ruta} no disponible (HTTP ${response.status}). Capa omitida.`);
            return null;
        }
        const data = await response.json();
        // Validación mínima de estructura GeoJSON
        if (!data.type || !data.features) {
            console.warn(`[GIS] ${ruta} no es un FeatureCollection válido.`);
            return null;
        }
        console.log(`[GIS] ✓ ${ruta} cargado — ${data.features.length} features`);
        return data;
    } catch (err) {
        console.warn(`[GIS] Error cargando ${ruta}:`, err.message);
        return null;
    }
}

// ── Inicialización del mapa ──────────────────────────────────────────

async function inicializarMapa() {
    if (mapaIniciado) return;
    mapaIniciado = true; // Flag inmediato para evitar doble init

    map = L.map('map', {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true
    });

    // Capa base: satélite Esri
    const baseSatelite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri — USDA, GeoEye, GIS Community', maxZoom: 18 }
    );

    // Capa base alternativa: topográfico
    const baseTopo = L.tileLayer(
        'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        { attribution: 'Map data &copy; OpenStreetMap, SRTM | Style &copy; OpenTopoMap', maxZoom: 17 }
    );

    baseSatelite.addTo(map);

    // Capa para resultados dinámicos de análisis (clustering, etc.)
    capaAnalisis = L.layerGroup().addTo(map);

    // ── Carga paralela de todas las capas GeoJSON ────────────────────
    const [datosLimites, datosLotes, datosRios, datosCanales, datosPozos] = await Promise.all([
        cargarGeoJSON('data/cajeme_limits.geojson'),
        cargarGeoJSON('data/lotes.geojson'),
        cargarGeoJSON('data/red_hidrografica.geojson'),
        cargarGeoJSON('data/canales_riego.geojson'),
        cargarGeoJSON('data/pozos.geojson')
    ]);

    // ── Renderizar cada capa si los datos existen ────────────────────

    // 1. Límites municipales de Cajeme
    if (datosLimites) {
        capaLimites = L.geoJSON(datosLimites, {
            style: () => ESTILOS.limites,
            onEachFeature: (feature, layer) => {
                const nombre = feature.properties.NOMGEO || feature.properties.nombre || 'Cajeme';
                layer.bindPopup(`<b>Municipio: ${nombre}</b>`);
            }
        }).addTo(map);
        // Ajustar vista al polígono municipal
        map.fitBounds(capaLimites.getBounds(), { padding: [20, 20] });
    }

    // 2. Parcelas agrícolas (lotes con datos de rendimiento/NDVI)
    if (datosLotes) {
        capaLotes = L.geoJSON(datosLotes, {
            style: (feature) => ({
                fillColor: obtenerColorRendimiento(feature.properties.rendimiento),
                weight: 2,
                color: '#FFFFFF',
                fillOpacity: 0.65
            }),
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                layer.bindPopup(
                    `<b>${p.nombre}</b><br>` +
                    `Estado: ${p.estado}<br>` +
                    `Rendimiento NDVI: <b>${p.rendimiento}%</b>`
                );
                layer.on('mouseover', function () {
                    this.setStyle({ fillOpacity: 0.9, weight: 4 });
                });
                layer.on('mouseout', function () {
                    capaLotes.resetStyle(this);
                });
            }
        }).addTo(map);

        // Si no hay límites municipales, centrar en los lotes
        if (!capaLimites) {
            map.fitBounds(capaLotes.getBounds(), { padding: [30, 30] });
        }
    }

    // 3. Red hidrográfica (ríos y arroyos)
    if (datosRios) {
        capaRios = L.geoJSON(datosRios, {
            style: (feature) => {
                const tipo = (feature.properties.TIPO || feature.properties.tipo || '').toLowerCase();
                if (tipo.includes('rio') || tipo.includes('río')) return ESTILOS.rio;
                return ESTILOS.arroyo;
            },
            onEachFeature: (feature, layer) => {
                const nombre = feature.properties.NOMBRE || feature.properties.nombre || 'Sin nombre';
                const tipo   = feature.properties.TIPO   || feature.properties.tipo   || '';
                layer.bindPopup(`<b>${nombre}</b><br>Tipo: ${tipo}`);
            },
            // Filtrar features vacías o sin geometría válida
            filter: (feature) => feature.geometry && feature.geometry.coordinates
        }).addTo(map);
    }

    // 4. Canales de riego (Distrito 041)
    if (datosCanales) {
        capaCanales = L.geoJSON(datosCanales, {
            style: () => ESTILOS.canal,
            onEachFeature: (feature, layer) => {
                const nombre = feature.properties.NOMBRE || feature.properties.name || feature.properties.nombre || 'Canal';
                layer.bindPopup(`<b>${nombre}</b><br>Infraestructura DR-041`);
            }
        }).addTo(map);
    }

    // 5. Pozos de extracción
    if (datosPozos) {
        capaPozos = L.geoJSON(datosPozos, {
            pointToLayer: (feature, latlng) => {
                const flujo = feature.properties.flujo || '';
                const esBajo = flujo.toLowerCase().includes('bajo') ||
                               (parseInt(flujo) > 0 && parseInt(flujo) < 20);
                return L.circleMarker(latlng, esBajo ? ESTILOS.pozo_bajo : ESTILOS.pozo_activo);
            },
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                layer.bindPopup(
                    `<b>${p.nombre || 'Pozo'}</b><br>` +
                    `Flujo: ${p.flujo || 'N/D'}<br>` +
                    `Estado: ${p.estado || 'N/D'}`
                );
            }
        }).addTo(map);
    }

    // ── Control de capas (toggle para el usuario) ────────────────────
    const baseMaps = {
        "Satélite (Esri)": baseSatelite,
        "Topográfico": baseTopo
    };

    // Solo agregar al control las capas que efectivamente se cargaron
    const overlays = {};
    if (capaLimites) overlays["Límites de Cajeme"]     = capaLimites;
    if (capaLotes)   overlays["Parcelas (NDVI)"]       = capaLotes;
    if (capaRios)    overlays["Red Hidrográfica"]       = capaRios;
    if (capaCanales) overlays["Canales de Riego DR-041"] = capaCanales;
    if (capaPozos)   overlays["Pozos de Extracción"]    = capaPozos;
    overlays["Análisis (K-Means)"] = capaAnalisis;

    L.control.layers(baseMaps, overlays, { collapsed: true }).addTo(map);

    // ── Escala métrica ───────────────────────────────────────────────
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    console.log("[GIS] Mapa inicializado correctamente.");
}

// ── Análisis: Clustering logístico (K-Means vía backend) ────────────

async function ejecutarAnalisisSIG() {
    console.log("[GIS] Conectando con el motor de clustering Python...");

    // Limpiar resultados previos
    if (capaAnalisis) capaAnalisis.clearLayers();

    try {
        const response = await fetch('http://127.0.0.1:8000/api/logistica_inteligente');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data.status !== "success") {
            console.error("[GIS] Respuesta inesperada del backend:", data);
            return;
        }

        const warehouseIcon = L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/2311/2311110.png',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -35]
        });

        // Puntos de demanda
        data.puntos_demanda.forEach(p => {
            L.circleMarker([p[0], p[1]], {
                radius: 5, color: '#E67E22', fillOpacity: 0.8, weight: 1
            }).addTo(capaAnalisis);
        });

        // Centroides: almacenes sugeridos
        data.almacenes_sugeridos.forEach((centro, i) => {
            L.marker([centro[0], centro[1]], { icon: warehouseIcon })
                .addTo(capaAnalisis)
                .bindPopup(
                    `<b>Almacén Sugerido ${i + 1}</b><br>` +
                    `Lat: ${centro[0].toFixed(4)}, Lng: ${centro[1].toFixed(4)}<br>` +
                    `Optimizado por K-Means (n=3)`
                );

            L.circle([centro[0], centro[1]], {
                color: '#27AE60', fillColor: '#2ECC71',
                fillOpacity: 0.15, radius: 800, weight: 1.5
            }).addTo(capaAnalisis);
        });

        // Centrar vista en los resultados
        const bounds = capaAnalisis.getLayers().length > 0
            ? L.featureGroup(capaAnalisis.getLayers()).getBounds()
            : null;
        if (bounds && bounds.isValid()) {
            map.flyToBounds(bounds, { padding: [40, 40], duration: 1.2 });
        }

        console.log(`[GIS] Clustering completado: ${data.almacenes_sugeridos.length} almacenes sugeridos.`);

    } catch (error) {
        console.error("[GIS] Error en la API de analítica espacial:", error);
    }
}
