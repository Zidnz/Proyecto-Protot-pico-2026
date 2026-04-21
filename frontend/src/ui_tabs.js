// ==========================================
// ui_tabs.js: Controladores de Interfaz y Recomendaciones
// ==========================================

function cambiarPestana(event, tabId) {
    if (event) event.preventDefault();
    document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));

    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.style.display = "block";
        if (tabId === 'tab-mapas') {
            setTimeout(async () => {
                await inicializarMapa();
                if (map) map.invalidateSize();
            }, 300);
        }
    }

    document.querySelectorAll(".nav-item").forEach(i => {
        if (i.getAttribute('onclick') && i.getAttribute('onclick').includes(tabId)) {
            i.classList.add("active");
        }
    });
}

function ejecutarPrescripcion() {
    const btn = document.querySelector('.btn-main');
    btn.innerHTML = "⌛ Optimizando...";
    setTimeout(() => {
        btn.innerHTML = "Guardar";
        alert("¡Prescripción guardada!");
    }, 1500);
}

// --- SISTEMA DE RECOMENDACIÓN (Filtrado Colaborativo) ---
const productos = ["Uva", "Maíz", "Frijol"];
const historial = [
    [[200, 230, 260], [0, 0, 0], [0, 0, 0]],
    [[210, 230, 250], [100, 120, 140], [200, 220, 240]],
    [[0, 0, 0], [90, 110, 130], [180, 200, 220]],
    [[190, 220, 250], [80, 90, 100], [160, 180, 200]]
];

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0; let normA = 0; let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function actualizarAnalisisBI() {
    const element = document.getElementById('select-cliente-bi');
    if(!element) return;
    const idx = parseInt(element.value);
    
    const promedios = historial.map(c => c.map(p => p.reduce((a,b) => a+b)/3));
    const promedioActual = promedios[idx];

    let maxSim = -1; let similarIdx = -1;
    promedios.forEach((p, i) => {
        if (i !== idx) {
            let sim = cosineSimilarity(promedioActual, p);
            if (sim > maxSim) { maxSim = sim; similarIdx = i; }
        }
    });

    let htmlRecs = "<h4>Producción Recomendada:</h4><ul>";
    promedioActual.forEach((p, i) => {
        let cantidad = p > 0 ? p : promedios[similarIdx][i];
        let esNuevo = p === 0 && promedios[similarIdx][i] > 0;
        
        htmlRecs += `<li>
            <b>${productos[i]}:</b> ${Math.round(cantidad)} kg 
            ${esNuevo ? '<span style="color: #7BB395;">(✨ Sugerencia IA)</span>' : ''}
        </li>`;
    });
    htmlRecs += "</ul>";

    document.getElementById('resultados-bi').innerHTML = `
        <p><b>Cliente más similar:</b> Perfil ${similarIdx + 1}</p>
        ${htmlRecs}
    `;
}