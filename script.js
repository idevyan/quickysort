// --- SINTETIZADOR DE AUDIO (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type = 'sine', duration = 0.1, vol = 0.1) {
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}

const sfx = {
    move() {
        playTone(180, 'sawtooth', 0.15, 0.05);
        playTone(140, 'triangle', 0.15, 0.08);
    },
    grab() {
        playTone(600, 'square', 0.08, 0.1);
        setTimeout(() => playTone(820, 'sine', 0.06, 0.08), 20);
    },
    compare(val) {
        playTone(280 + val * 60, 'sine', 0.09, 0.07);
    },
    swap() {
        playTone(220, 'triangle', 0.25, 0.12);
        setTimeout(() => playTone(330, 'triangle', 0.2, 0.12), 80);
    },
    success() {
        [440, 554, 659, 880].forEach((freq, idx) => {
            setTimeout(() => playTone(freq, 'sine', 0.2, 0.1), idx * 90);
        });
    }
};

// --- CONFIGURACIÓN DE POSICIONES Y ESTADOS ---
const NUM_BLOCKS = 8;
const SVG_NS = "http://www.w3.org/2000/svg";
const STAGE = document.getElementById('stage-svg');
const STATUS_TERMINAL = document.getElementById('status-terminal');
const BTN_RUN = document.getElementById('btn-run');
const BTN_RESET = document.getElementById('btn-reset');

// Coordenadas fijas
const RAIL_Y = 50;
const FLOOR_Y = 430;
const LIFT_PIVOT_Y = 135;  // Altura alta de suspensión (como bloque 4 en imagen)
const LIFT_MIN_Y = 240;    // Altura media de suspensión (como bloque 5 en imagen)
const BLOCK_WIDTH = 58;
const SLOT_SPACING = 110;
const FIRST_SLOT_X = 115;

let values = [];
let blockObjects = [];

function getSlotX(index) {
    return FIRST_SLOT_X + index * SLOT_SPACING;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Estructura de Bloque
class VisualBlock {
    constructor(val, initialIndex) {
        this.val = val;
        this.index = initialIndex;
        this.state = 'pending'; // 'pending', 'sorted', 'pivot', 'min'
        
        // Altura proporcional (como en la imagen: 1 es bajo, 8 es alto)
        this.height = 38 + val * 10;
        this.x = getSlotX(initialIndex);
        this.y = FLOOR_Y - this.height;
    }

    setTarget(x, y) {
        this.x = x;
        this.y = y;
    }
}

// Inicializar arreglo aleatorio
function setupArray() {
    values = [1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
    blockObjects = values.map((val, idx) => new VisualBlock(val, idx));
    renderScene(null, null);
    STATUS_TERMINAL.textContent = "SISTEMA LISTO // PRESIONE EJECUTAR ORDENAMIENTO";
}

// Dibuja riel, grúa, cables y bloques en SVG
function renderScene(pivotIdx = null, minIdx = null) {
    STAGE.innerHTML = '';

    // 1. Riel horizontal superior
    const rail = document.createElementNS(SVG_NS, 'line');
    rail.setAttribute('x1', '50');
    rail.setAttribute('y1', RAIL_Y);
    rail.setAttribute('x2', '950');
    rail.setAttribute('y2', RAIL_Y);
    rail.setAttribute('stroke', '#1e3a5f');
    rail.setAttribute('stroke-width', '2');
    STAGE.appendChild(rail);

    // 2. Línea de piso
    const floor = document.createElementNS(SVG_NS, 'line');
    floor.setAttribute('x1', '50');
    floor.setAttribute('y1', FLOOR_Y);
    floor.setAttribute('x2', '950');
    floor.setAttribute('y2', FLOOR_Y);
    floor.setAttribute('stroke', 'rgba(255, 255, 255, 0.1)');
    floor.setAttribute('stroke-width', '2');
    floor.setAttribute('stroke-dasharray', '6,6');
    STAGE.appendChild(floor);

    // 3. Mecanismo de Grúa (Carro, Cables Dobles y Ganchos)
    if (pivotIdx !== null || minIdx !== null) {
        let trolleyX;
        if (pivotIdx !== null && minIdx !== null) {
            trolleyX = (blockObjects[pivotIdx].x + blockObjects[minIdx].x) / 2 + BLOCK_WIDTH / 2;
        } else if (pivotIdx !== null) {
            trolleyX = blockObjects[pivotIdx].x + BLOCK_WIDTH / 2;
        } else {
            trolleyX = blockObjects[minIdx].x + BLOCK_WIDTH / 2;
        }

        // Carro superior en el riel con punto central
        const trolleyGroup = document.createElementNS(SVG_NS, 'g');
        trolleyGroup.innerHTML = `
            <rect x="${trolleyX - 26}" y="${RAIL_Y - 8}" width="52" height="16" rx="4" fill="#b45309" stroke="#f59e0b" stroke-width="1.5" />
            <circle cx="${trolleyX}" cy="${RAIL_Y}" r="2.5" fill="#fef3c7" />
        `;
        STAGE.appendChild(trolleyGroup);

        // Cable doble y gancho para Brazo Pivote (Izquierda - Ámbar)
        if (pivotIdx !== null) {
            const b = blockObjects[pivotIdx];
            const hookCenterX = b.x + BLOCK_WIDTH / 2;
            const hookTopY = b.y - 12;

            const cablesPivot = document.createElementNS(SVG_NS, 'g');
            cablesPivot.innerHTML = `
                <!-- Cables dobles -->
                <line x1="${trolleyX - 12}" y1="${RAIL_Y + 8}" x2="${hookCenterX - 10}" y2="${hookTopY}" stroke="#f59e0b" stroke-width="2" />
                <line x1="${trolleyX - 6}" y1="${RAIL_Y + 8}" x2="${hookCenterX + 10}" y2="${hookTopY}" stroke="#f59e0b" stroke-width="2" />
                
                <!-- Cabezal del gancho -->
                <rect x="${hookCenterX - 18}" y="${hookTopY - 6}" width="36" height="10" rx="3" fill="#92400e" stroke="#fbbf24" stroke-width="1.5" />
                
                <!-- Abrazaderas laterales que sostienen el bloque -->
                <path d="M ${b.x - 4} ${hookTopY + 2} L ${b.x - 4} ${b.y + 14} L ${b.x} ${b.y + 14}" fill="none" stroke="#fbbf24" stroke-width="2.5" />
                <path d="M ${b.x + BLOCK_WIDTH + 4} ${hookTopY + 2} L ${b.x + BLOCK_WIDTH + 4} ${b.y + 14} L ${b.x + BLOCK_WIDTH} ${b.y + 14}" fill="none" stroke="#fbbf24" stroke-width="2.5" />
            `;
            STAGE.appendChild(cablesPivot);
        }

        // Cable doble y gancho para Brazo Mínimo/Comparador (Derecha - Carmesí)
        if (minIdx !== null) {
            const b = blockObjects[minIdx];
            const hookCenterX = b.x + BLOCK_WIDTH / 2;
            const hookTopY = b.y - 12;

            const cablesMin = document.createElementNS(SVG_NS, 'g');
            cablesMin.innerHTML = `
                <!-- Cables dobles -->
                <line x1="${trolleyX + 6}" y1="${RAIL_Y + 8}" x2="${hookCenterX - 10}" y2="${hookTopY}" stroke="#f43f5e" stroke-width="2" />
                <line x1="${trolleyX + 12}" y1="${RAIL_Y + 8}" x2="${hookCenterX + 10}" y2="${hookTopY}" stroke="#f43f5e" stroke-width="2" />
                
                <!-- Cabezal del gancho -->
                <rect x="${hookCenterX - 18}" y="${hookTopY - 6}" width="36" height="10" rx="3" fill="#9f1239" stroke="#f43f5e" stroke-width="1.5" />
                
                <!-- Abrazaderas laterales -->
                <path d="M ${b.x - 4} ${hookTopY + 2} L ${b.x - 4} ${b.y + 14} L ${b.x} ${b.y + 14}" fill="none" stroke="#f43f5e" stroke-width="2.5" />
                <path d="M ${b.x + BLOCK_WIDTH + 4} ${hookTopY + 2} L ${b.x + BLOCK_WIDTH + 4} ${b.y + 14} L ${b.x + BLOCK_WIDTH} ${b.y + 14}" fill="none" stroke="#f43f5e" stroke-width="2.5" />
            `;
            STAGE.appendChild(cablesMin);
        }
    }

    // 4. Render de los Bloques
    blockObjects.forEach(b => {
        let fillColor, strokeColor, shadowGlow;

        if (b.state === 'sorted') {
            fillColor = '#064e3b';
            strokeColor = '#10b981';
            shadowGlow = 'rgba(16, 185, 129, 0.4)';
        } else if (b.state === 'pivot') {
            fillColor = '#78350f';
            strokeColor = '#fbbf24';
            shadowGlow = 'rgba(251, 191, 36, 0.7)';
        } else if (b.state === 'min') {
            fillColor = '#881337';
            strokeColor = '#f43f5e';
            shadowGlow = 'rgba(244, 63, 94, 0.7)';
        } else {
            // Pending (Rojizo como en la imagen de referencia)
            fillColor = '#3f151b';
            strokeColor = '#e11d48';
            shadowGlow = 'none';
        }

        const blockGroup = document.createElementNS(SVG_NS, 'g');
        blockGroup.innerHTML = `
            <rect x="${b.x}" y="${b.y}" width="${BLOCK_WIDTH}" height="${b.height}" rx="6" 
                  fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.2" 
                  style="filter: drop-shadow(0 0 6px ${shadowGlow}); transition: y 0.2s ease, x 0.3s ease;" />
            <text x="${b.x + BLOCK_WIDTH / 2}" y="${b.y + b.height - 12}" 
                  font-family="'JetBrains Mono', monospace" font-size="1.25rem" font-weight="800" 
                  fill="#ffffff" text-anchor="middle" pointer-events="none">${b.val}</text>
        `;
        STAGE.appendChild(blockGroup);
    });
}

// --- ALGORITMO SELECTION SORT PASO A PASO ---
async function runSelectionSort() {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    BTN_RUN.disabled = true;
    BTN_RESET.disabled = true;

    for (let i = 0; i < NUM_BLOCKS; i++) {
        let minIdx = i;

        // 1. Enganche y elevación del Pivote (Brazo Izquierdo)
        STATUS_TERMINAL.textContent = `[PASO ${i+1}] ENGANCHANDO PIVOTE INDICE [${i}] (VALOR: ${blockObjects[i].val})`;
        sfx.grab();
        blockObjects[i].state = 'pivot';
        blockObjects[i].setTarget(getSlotX(i), LIFT_PIVOT_Y);
        renderScene(i, null);
        await sleep(550);

        for (let j = i + 1; j < NUM_BLOCKS; j++) {
            STATUS_TERMINAL.textContent = `COMPARANDO PIVOTE [${blockObjects[minIdx].val}] CON INDICE [${j}] (VALOR: ${blockObjects[j].val})`;
            sfx.move();

            // Brazo derecho baja y levanta candidato j a altura media
            blockObjects[j].state = 'min';
            blockObjects[j].setTarget(getSlotX(j), LIFT_MIN_Y);
            renderScene(i, j);
            sfx.compare(blockObjects[j].val);
            await sleep(500);

            if (blockObjects[j].val < blockObjects[minIdx].val) {
                STATUS_TERMINAL.textContent = `NUEVO MINIMO ENCONTRADO: ${blockObjects[j].val} < ${blockObjects[minIdx].val}`;
                sfx.grab();

                // Si había un mínimo anterior que no era i, devolverlo al suelo
                if (minIdx !== i) {
                    blockObjects[minIdx].state = 'pending';
                    blockObjects[minIdx].setTarget(getSlotX(minIdx), FLOOR_Y - blockObjects[minIdx].height);
                }

                minIdx = j;
                await sleep(350);
            } else {
                // No fue menor: regresarlo a la base
                blockObjects[j].state = 'pending';
                blockObjects[j].setTarget(getSlotX(j), FLOOR_Y - blockObjects[j].height);
                renderScene(i, minIdx !== i ? minIdx : null);
                await sleep(300);
            }
        }

        // 2. Intercambio (Swap) si se halló un mínimo
        if (minIdx !== i) {
            STATUS_TERMINAL.textContent = `INTERCAMBIANDO POSICIONES [${i}] Y [${minIdx}]...`;
            sfx.swap();

            const targetXi = getSlotX(i);
            const targetXmin = getSlotX(minIdx);

            // Traslado horizontal aéreo
            blockObjects[i].setTarget(targetXmin, LIFT_PIVOT_Y);
            blockObjects[minIdx].setTarget(targetXi, LIFT_MIN_Y);
            renderScene(i, minIdx);
            await sleep(700);

            // Descenso a los slots del piso
            sfx.grab();
            blockObjects[minIdx].setTarget(targetXi, FLOOR_Y - blockObjects[minIdx].height);
            blockObjects[i].setTarget(targetXmin, FLOOR_Y - blockObjects[i].height);
            renderScene(i, minIdx);
            await sleep(400);

            // Reorganización en el array de objetos
            const temp = blockObjects[i];
            blockObjects[i] = blockObjects[minIdx];
            blockObjects[minIdx] = temp;

            blockObjects[minIdx].state = 'pending';
        } else {
            // El pivote ya era el menor: descenso
            blockObjects[i].setTarget(getSlotX(i), FLOOR_Y - blockObjects[i].height);
            await sleep(300);
        }

        // Marcado como ordenado (Verde)
        blockObjects[i].state = 'sorted';
        renderScene(null, null);
        await sleep(250);
    }

    STATUS_TERMINAL.textContent = "OPERACION COMPLETADA // ARREGLO ORDENADO";
    sfx.success();
    renderScene(null, null);

    BTN_RUN.disabled = false;
    BTN_RESET.disabled = false;
}

// Inicialización inicial
window.onload = setupArray;
