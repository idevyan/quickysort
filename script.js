// --- SISTEMA DE AUDIO DIGITAL SINTETIZADO ---
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
        playTone(180, 'sawtooth', 0.12, 0.04);
        playTone(140, 'triangle', 0.12, 0.06);
    },
    grab() {
        playTone(580, 'square', 0.08, 0.09);
        setTimeout(() => playTone(820, 'sine', 0.06, 0.08), 20);
    },
    compare(val) {
        playTone(300 + val * 60, 'sine', 0.08, 0.07);
    },
    swap() {
        playTone(220, 'triangle', 0.2, 0.1);
        setTimeout(() => playTone(330, 'triangle', 0.18, 0.1), 80);
    },
    discard() {
        playTone(200, 'sawtooth', 0.15, 0.06);
        setTimeout(() => playTone(120, 'sawtooth', 0.15, 0.05), 60);
    },
    success() {
        [440, 554, 659, 880].forEach((freq, idx) => {
            setTimeout(() => playTone(freq, 'sine', 0.2, 0.09), idx * 80);
        });
    },
    stop() {
        playTone(150, 'square', 0.25, 0.15);
    }
};

// --- CONSTANTES DEL ENTORNO ---
const NUM_BLOCKS = 8;
const SVG_NS = "http://www.w3.org/2000/svg";
const STAGE = document.getElementById('stage-svg');
const STATUS_TERMINAL = document.getElementById('status-terminal');

const BTN_RUN_SORT = document.getElementById('btn-run-sort');
const BTN_RESET = document.getElementById('btn-reset');
const BTN_STOP = document.getElementById('btn-stop');
const BTN_RUN_SEARCH = document.getElementById('btn-run-search');
const TARGET_SELECT = document.getElementById('target-select');

const RAIL_Y = 50;
const FLOOR_Y = 430;
const LIFT_PIVOT_Y = 135;
const LIFT_MIN_Y = 240;
const BLOCK_WIDTH = 58;
const SLOT_SPACING = 110;
const FIRST_SLOT_X = 115;

let values = [];
let blockObjects = [];
let isExecutionHalted = false;
let isArraySorted = false;
let currentResolveSleep = null;

function getSlotX(index) {
    return FIRST_SLOT_X + index * SLOT_SPACING;
}

// Pausa cancelable al instante
function sleep(ms) {
    return new Promise(resolve => {
        currentResolveSleep = resolve;
        setTimeout(() => {
            currentResolveSleep = null;
            resolve();
        }, ms);
    });
}

class VisualBlock {
    constructor(val, initialIndex) {
        this.val = val;
        this.index = initialIndex;
        this.state = 'pending';
        this.height = 38 + val * 10;
        this.x = getSlotX(initialIndex);
        this.y = FLOOR_Y - this.height;
    }

    setTarget(x, y) {
        this.x = x;
        this.y = y;
    }
}

// Inicializar vector
function setupArray(sorted = false) {
    isExecutionHalted = false;
    values = [1, 2, 3, 4, 5, 6, 7, 8];
    if (!sorted) {
        values.sort(() => Math.random() - 0.5);
        isArraySorted = false;
    } else {
        isArraySorted = true;
    }

    blockObjects = values.map((val, idx) => {
        const b = new VisualBlock(val, idx);
        if (sorted) b.state = 'sorted';
        return b;
    });

    renderScene(null, null);
    STATUS_TERMINAL.textContent = sorted 
        ? "ARREGLO ORDENADO // LISTO PARA BUSQUEDA BINARIA"
        : "SISTEMA LISTO // SELECCIONE ORDENAR O BUSQUEDA";
}

// Dibuja el escenario en SVG
function renderScene(pivotIdx = null, minIdx = null, rangeIndicators = null) {
    STAGE.innerHTML = '';

    // Riel horizontal
    const rail = document.createElementNS(SVG_NS, 'line');
    rail.setAttribute('x1', '50');
    rail.setAttribute('y1', RAIL_Y);
    rail.setAttribute('x2', '950');
    rail.setAttribute('y2', RAIL_Y);
    rail.setAttribute('stroke', '#1e3a5f');
    rail.setAttribute('stroke-width', '2');
    STAGE.appendChild(rail);

    // Línea de suelo
    const floor = document.createElementNS(SVG_NS, 'line');
    floor.setAttribute('x1', '50');
    floor.setAttribute('y1', FLOOR_Y);
    floor.setAttribute('x2', '950');
    floor.setAttribute('y2', FLOOR_Y);
    floor.setAttribute('stroke', 'rgba(255, 255, 255, 0.1)');
    floor.setAttribute('stroke-width', '2');
    floor.setAttribute('stroke-dasharray', '6,6');
    STAGE.appendChild(floor);

    // Indicadores de rango [L, R] en Búsqueda Binaria
    if (rangeIndicators) {
        const { low, high } = rangeIndicators;
        const lx = getSlotX(low) + BLOCK_WIDTH / 2;
        const rx = getSlotX(high) + BLOCK_WIDTH / 2;

        const rangeGroup = document.createElementNS(SVG_NS, 'g');
        rangeGroup.innerHTML = `
            <text x="${lx}" y="${FLOOR_Y + 28}" font-family="'JetBrains Mono', monospace" font-size="0.8rem" font-weight="700" fill="#fbbf24" text-anchor="middle">L=${low}</text>
            <text x="${rx}" y="${FLOOR_Y + 28}" font-family="'JetBrains Mono', monospace" font-size="0.8rem" font-weight="700" fill="#f43f5e" text-anchor="middle">R=${high}</text>
        `;
        STAGE.appendChild(rangeGroup);
    }

    // Mecanismo de Grúa
    if (pivotIdx !== null || minIdx !== null) {
        let trolleyX;
        if (pivotIdx !== null && minIdx !== null) {
            trolleyX = (blockObjects[pivotIdx].x + blockObjects[minIdx].x) / 2 + BLOCK_WIDTH / 2;
        } else if (pivotIdx !== null) {
            trolleyX = blockObjects[pivotIdx].x + BLOCK_WIDTH / 2;
        } else {
            trolleyX = blockObjects[minIdx].x + BLOCK_WIDTH / 2;
        }

        const trolleyGroup = document.createElementNS(SVG_NS, 'g');
        trolleyGroup.innerHTML = `
            <rect x="${trolleyX - 26}" y="${RAIL_Y - 8}" width="52" height="16" rx="4" fill="#b45309" stroke="#f59e0b" stroke-width="1.5" />
            <circle cx="${trolleyX}" cy="${RAIL_Y}" r="2.5" fill="#fef3c7" />
        `;
        STAGE.appendChild(trolleyGroup);

        // Gancho Izquierdo
        if (pivotIdx !== null) {
            const b = blockObjects[pivotIdx];
            const hookCenterX = b.x + BLOCK_WIDTH / 2;
            const hookTopY = b.y - 12;

            const cablesPivot = document.createElementNS(SVG_NS, 'g');
            cablesPivot.innerHTML = `
                <line x1="${trolleyX - 12}" y1="${RAIL_Y + 8}" x2="${hookCenterX - 10}" y2="${hookTopY}" stroke="#f59e0b" stroke-width="2" />
                <line x1="${trolleyX - 6}" y1="${RAIL_Y + 8}" x2="${hookCenterX + 10}" y2="${hookTopY}" stroke="#f59e0b" stroke-width="2" />
                <rect x="${hookCenterX - 18}" y="${hookTopY - 6}" width="36" height="10" rx="3" fill="#92400e" stroke="#fbbf24" stroke-width="1.5" />
                <path d="M ${b.x - 4} ${hookTopY + 2} L ${b.x - 4} ${b.y + 14} L ${b.x} ${b.y + 14}" fill="none" stroke="#fbbf24" stroke-width="2.5" />
                <path d="M ${b.x + BLOCK_WIDTH + 4} ${hookTopY + 2} L ${b.x + BLOCK_WIDTH + 4} ${b.y + 14} L ${b.x + BLOCK_WIDTH} ${b.y + 14}" fill="none" stroke="#fbbf24" stroke-width="2.5" />
            `;
            STAGE.appendChild(cablesPivot);
        }

        // Gancho Derecho
        if (minIdx !== null) {
            const b = blockObjects[minIdx];
            const hookCenterX = b.x + BLOCK_WIDTH / 2;
            const hookTopY = b.y - 12;

            const cablesMin = document.createElementNS(SVG_NS, 'g');
            cablesMin.innerHTML = `
                <line x1="${trolleyX + 6}" y1="${RAIL_Y + 8}" x2="${hookCenterX - 10}" y2="${hookTopY}" stroke="#f43f5e" stroke-width="2" />
                <line x1="${trolleyX + 12}" y1="${RAIL_Y + 8}" x2="${hookCenterX + 10}" y2="${hookTopY}" stroke="#f43f5e" stroke-width="2" />
                <rect x="${hookCenterX - 18}" y="${hookTopY - 6}" width="36" height="10" rx="3" fill="#9f1239" stroke="#f43f5e" stroke-width="1.5" />
                <path d="M ${b.x - 4} ${hookTopY + 2} L ${b.x - 4} ${b.y + 14} L ${b.x} ${b.y + 14}" fill="none" stroke="#f43f5e" stroke-width="2.5" />
                <path d="M ${b.x + BLOCK_WIDTH + 4} ${hookTopY + 2} L ${b.x + BLOCK_WIDTH + 4} ${b.y + 14} L ${b.x + BLOCK_WIDTH} ${b.y + 14}" fill="none" stroke="#f43f5e" stroke-width="2.5" />
            `;
            STAGE.appendChild(cablesMin);
        }
    }

    // Bloques
    blockObjects.forEach(b => {
        let fillColor, strokeColor, shadowGlow, opacity;

        switch (b.state) {
            case 'sorted':
                fillColor = '#064e3b';
                strokeColor = '#10b981';
                shadowGlow = 'rgba(16, 185, 129, 0.4)';
                opacity = 1;
                break;
            case 'pivot':
                fillColor = '#78350f';
                strokeColor = '#fbbf24';
                shadowGlow = 'rgba(251, 191, 36, 0.7)';
                opacity = 1;
                break;
            case 'min':
                fillColor = '#881337';
                strokeColor = '#f43f5e';
                shadowGlow = 'rgba(244, 63, 94, 0.7)';
                opacity = 1;
                break;
            case 'discarded':
                fillColor = '#1e293b';
                strokeColor = '#475569';
                shadowGlow = 'none';
                opacity = 0.25;
                break;
            default: // pending
                fillColor = '#3f151b';
                strokeColor = '#e11d48';
                shadowGlow = 'none';
                opacity = 1;
                break;
        }

        const blockGroup = document.createElementNS(SVG_NS, 'g');
        blockGroup.innerHTML = `
            <rect x="${b.x}" y="${b.y}" width="${BLOCK_WIDTH}" height="${b.height}" rx="6" 
                  fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.2" opacity="${opacity}"
                  style="filter: drop-shadow(0 0 6px ${shadowGlow}); transition: y 0.25s ease, x 0.35s ease;" />
            <text x="${b.x + BLOCK_WIDTH / 2}" y="${b.y + b.height - 12}" 
                  font-family="'JetBrains Mono', monospace" font-size="1.25rem" font-weight="800" 
                  fill="#ffffff" opacity="${opacity}" text-anchor="middle" pointer-events="none">${b.val}</text>
        `;
        STAGE.appendChild(blockGroup);
    });
}

function setControlsState(running) {
    BTN_RUN_SORT.disabled = running;
    BTN_RESET.disabled = running;
    BTN_RUN_SEARCH.disabled = running;
    TARGET_SELECT.disabled = running;
    BTN_STOP.disabled = !running;
}

// Parada de emergencia
function stopExecution() {
    isExecutionHalted = true;
    if (currentResolveSleep) {
        currentResolveSleep();
    }

    sfx.stop();
    STATUS_TERMINAL.textContent = "OPERACION INTERRUMPIDA // SISTEMA DETENIDO";

    blockObjects.forEach((b, idx) => {
        b.setTarget(getSlotX(idx), FLOOR_Y - b.height);
        if (b.state !== 'sorted') b.state = 'pending';
    });

    renderScene(null, null);
    setControlsState(false);
}

// --- ALGORITMO SELECTION SORT ---
async function runSelectionSort() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isExecutionHalted = false;
    setControlsState(true);

    for (let i = 0; i < NUM_BLOCKS; i++) {
        if (isExecutionHalted) return;
        let minIdx = i;

        STATUS_TERMINAL.textContent = `[SORT] PIVOTE POSICION [${i}] // VALOR: ${blockObjects[i].val}`;
        sfx.grab();
        blockObjects[i].state = 'pivot';
        blockObjects[i].setTarget(getSlotX(i), LIFT_PIVOT_Y);
        renderScene(i, null);
        await sleep(500);

        for (let j = i + 1; j < NUM_BLOCKS; j++) {
            if (isExecutionHalted) return;

            STATUS_TERMINAL.textContent = `COMPARANDO [${blockObjects[minIdx].val}] CON INDICE [${j}] (${blockObjects[j].val})`;
            sfx.move();
            blockObjects[j].state = 'min';
            blockObjects[j].setTarget(getSlotX(j), LIFT_MIN_Y);
            renderScene(i, j);
            sfx.compare(blockObjects[j].val);
            await sleep(450);

            if (blockObjects[j].val < blockObjects[minIdx].val) {
                STATUS_TERMINAL.textContent = `NUEVO MINIMO: ${blockObjects[j].val} < ${blockObjects[minIdx].val}`;
                sfx.grab();

                if (minIdx !== i) {
                    blockObjects[minIdx].state = 'pending';
                    blockObjects[minIdx].setTarget(getSlotX(minIdx), FLOOR_Y - blockObjects[minIdx].height);
                }
                minIdx = j;
                await sleep(300);
            } else {
                blockObjects[j].state = 'pending';
                blockObjects[j].setTarget(getSlotX(j), FLOOR_Y - blockObjects[j].height);
                renderScene(i, minIdx !== i ? minIdx : null);
                await sleep(250);
            }
        }

        if (isExecutionHalted) return;

        if (minIdx !== i) {
            STATUS_TERMINAL.textContent = `INTERCAMBIANDO POSICIONES [${i}] Y [${minIdx}]...`;
            sfx.swap();

            const targetXi = getSlotX(i);
            const targetXmin = getSlotX(minIdx);

            blockObjects[i].setTarget(targetXmin, LIFT_PIVOT_Y);
            blockObjects[minIdx].setTarget(targetXi, LIFT_MIN_Y);
            renderScene(i, minIdx);
            await sleep(650);

            sfx.grab();
            blockObjects[minIdx].setTarget(targetXi, FLOOR_Y - blockObjects[minIdx].height);
            blockObjects[i].setTarget(targetXmin, FLOOR_Y - blockObjects[i].height);
            renderScene(i, minIdx);
            await sleep(350);

            const temp = blockObjects[i];
            blockObjects[i] = blockObjects[minIdx];
            blockObjects[minIdx] = temp;

            blockObjects[minIdx].state = 'pending';
        } else {
            blockObjects[i].setTarget(getSlotX(i), FLOOR_Y - blockObjects[i].height);
            await sleep(250);
        }

        blockObjects[i].state = 'sorted';
        renderScene(null, null);
        await sleep(200);
    }

    isArraySorted = true;
    STATUS_TERMINAL.textContent = "SELECTION SORT FINALIZADO // ARREGLO ORDENADO";
    sfx.success();
    setControlsState(false);
}

// --- ALGORITMO BUSQUEDA BINARIA ---
async function runBinarySearch() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isExecutionHalted = false;

    if (!isArraySorted) {
        STATUS_TERMINAL.textContent = "ORDENANDO ARREGLO PARA EJECUTAR BUSQUEDA BINARIA...";
        setupArray(true);
        await sleep(600);
    }

    setControlsState(true);
    const target = parseInt(TARGET_SELECT.value, 10);
    STATUS_TERMINAL.textContent = `INICIANDO BUSQUEDA BINARIA // OBJETIVO: ${target}`;
    
    blockObjects.forEach(b => b.state = 'sorted');
    renderScene(null, null);
    await sleep(500);

    let low = 0;
    let high = NUM_BLOCKS - 1;
    let foundIndex = -1;

    while (low <= high) {
        if (isExecutionHalted) return;

        const mid = Math.floor((low + high) / 2);
        const midBlock = blockObjects[mid];

        STATUS_TERMINAL.textContent = `RANGO [${low} - ${high}] // EVALUANDO ELEMENTO MEDIO EN [${mid}] (VALOR: ${midBlock.val})`;
        sfx.move();

        midBlock.state = 'min';
        midBlock.setTarget(getSlotX(mid), LIFT_PIVOT_Y);
        renderScene(null, mid, { low, high });
        sfx.grab();
        await sleep(600);

        sfx.compare(midBlock.val);

        if (midBlock.val === target) {
            STATUS_TERMINAL.textContent = `OBJETIVO [${target}] ENCONTRADO EN INDICE [${mid}]`;
            midBlock.state = 'sorted';
            sfx.success();
            foundIndex = mid;
            await sleep(600);
            midBlock.setTarget(getSlotX(mid), FLOOR_Y - midBlock.height);
            renderScene(null, null);
            break;
        } else if (midBlock.val < target) {
            STATUS_TERMINAL.textContent = `${midBlock.val} < ${target} // DESCARTANDO RANGO IZQUIERDO [${low} - ${mid}]`;
            sfx.discard();

            for (let k = low; k <= mid; k++) {
                blockObjects[k].state = 'discarded';
            }
            midBlock.setTarget(getSlotX(mid), FLOOR_Y - midBlock.height);
            renderScene(null, null, { low, high });
            await sleep(550);

            low = mid + 1;
        } else {
            STATUS_TERMINAL.textContent = `${midBlock.val} > ${target} // DESCARTANDO RANGO DERECHO [${mid} - ${high}]`;
            sfx.discard();

            for (let k = mid; k <= high; k++) {
                blockObjects[k].state = 'discarded';
            }
            midBlock.setTarget(getSlotX(mid), FLOOR_Y - midBlock.height);
            renderScene(null, null, { low, high });
            await sleep(550);

            high = mid - 1;
        }
    }

    if (foundIndex === -1 && !isExecutionHalted) {
        STATUS_TERMINAL.textContent = `VALOR [${target}] NO LOCALIZADO EN EL VECTOR`;
        sfx.stop();
        renderScene(null, null);
    }

    setControlsState(false);
}

// Carga inicial
window.onload = () => setupArray(false);
