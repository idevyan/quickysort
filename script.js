// --- SISTEMA DE AUDIO MECÁNICO / ARCADE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type = 'sine', duration = 0.1, vol = 0.1) {
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}

// Sonido de servo de la grúa moviéndose
function playServoSound() {
    playTone(220, 'triangle', 0.18, 0.08);
    setTimeout(() => playTone(180, 'sawtooth', 0.12, 0.05), 50);
}

// Sonido mecánico de gancho enganchando
function playClankSound() {
    playTone(520, 'square', 0.08, 0.15);
    setTimeout(() => playTone(800, 'sine', 0.06, 0.1), 30);
}

// Sonido de comparación rápida
function playCompareSound(val) {
    playTone(300 + val * 60, 'sine', 0.08, 0.08);
}

// Sonido de fanfarria al completar
function playVictory() {
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, idx) => {
        setTimeout(() => playTone(freq, 'triangle', 0.2, 0.15), idx * 110);
    });
}

// --- CONFIGURACIÓN DEL ESCENARIO ---
const NUM_ELEMENTS = 8;
const FLOOR_Y = 320;     // Nivel del piso
const LIFT_Y_PIVOT = 90; // Altura a la que la grúa sube el pivote
const LIFT_Y_MIN = 170;  // Altura a la que sube el candidato/mínimo
const START_X = 65;
const SPACING_X = 105;

let arr = [];
let blockElements = [];
const blocksStage = document.getElementById('blocks-stage');
const craneSvg = document.getElementById('crane-svg');
const statusText = document.getElementById('status-text');
const btnStart = document.getElementById('btn-start');
const btnReset = document.getElementById('btn-reset');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getSlotX(index) {
    return START_X + index * SPACING_X;
}

// Inicializar el arreglo y construir la vista
function initSimulation() {
    craneSvg.innerHTML = '';
    blocksStage.innerHTML = '';
    blockElements = [];
    arr = [];

    // Generar 8 números del 1 al 8 desordenados
    const nums = [1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);

    for (let i = 0; i < NUM_ELEMENTS; i++) {
        const val = nums[i];
        arr.push(val);

        const el = document.createElement('div');
        el.className = 'block unsorted';
        el.textContent = val;

        // Altura proporcional al número
        const height = 45 + val * 8;
        el.style.height = `${height}px`;

        const posX = getSlotX(i);
        const posY = FLOOR_Y - height;

        el.style.transform = `translate(${posX}px, ${posY}px)`;
        el.dataset.x = posX;
        el.dataset.y = posY;
        el.dataset.height = height;

        blocksStage.appendChild(el);
        blockElements.push(el);
    }

    statusText.textContent = 'Arreglo listo. Haz clic en "Iniciar Dinámica".';
}

// Mover un bloque a una coordenada específica
function moveBlock(index, x, y) {
    const el = blockElements[index];
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.dataset.x = x;
    el.dataset.y = y;
}

// Dibujar la grúa, cables y ganchos conectando los bloques
function updateCrane(pivotIndex = null, minIndex = null) {
    craneSvg.innerHTML = '';
    if (pivotIndex === null && minIndex === null) return;

    let targetX = 0;
    if (pivotIndex !== null && minIndex !== null) {
        targetX = (parseFloat(blockElements[pivotIndex].dataset.x) + parseFloat(blockElements[minIndex].dataset.x)) / 2 + 29;
    } else if (pivotIndex !== null) {
        targetX = parseFloat(blockElements[pivotIndex].dataset.x) + 29;
    } else {
        targetX = parseFloat(blockElements[minIndex].dataset.x) + 29;
    }

    const trolleyY = 25;

    // Carro de la grúa en el riel
    const trolley = `
        <rect x="${targetX - 25}" y="${trolleyY - 6}" width="50" height="14" rx="4" fill="#f59e0b" stroke="#fff" stroke-width="1.5" />
        <circle cx="${targetX}" cy="${trolleyY + 1}" r="3" fill="#111" />
    `;

    let cables = '';

    // Brazo izquierdo (Pivote)
    if (pivotIndex !== null) {
        const bx = parseFloat(blockElements[pivotIndex].dataset.x) + 29;
        const by = parseFloat(blockElements[pivotIndex].dataset.y);
        cables += `
            <line x1="${targetX - 10}" y1="${trolleyY + 8}" x2="${bx - 12}" y2="${by - 12}" stroke="#fbbf24" stroke-width="2.5" />
            <line x1="${targetX - 5}" y1="${trolleyY + 8}" x2="${bx + 12}" y2="${by - 12}" stroke="#fbbf24" stroke-width="2.5" />
            <!-- Gancho -->
            <rect x="${bx - 16}" y="${by - 16}" width="32" height="10" rx="3" fill="#d97706" stroke="#fbbf24" stroke-width="1.5" />
            <path d="M ${bx - 18} ${by - 10} L ${bx - 18} ${by + 6} L ${bx - 10} ${by + 6}" fill="none" stroke="#fbbf24" stroke-width="2" />
            <path d="M ${bx + 18} ${by - 10} L ${bx + 18} ${by + 6} L ${bx + 10} ${by + 6}" fill="none" stroke="#fbbf24" stroke-width="2" />
        `;
    }

    // Brazo derecho (Mínimo o Comparando)
    if (minIndex !== null) {
        const bx = parseFloat(blockElements[minIndex].dataset.x) + 29;
        const by = parseFloat(blockElements[minIndex].dataset.y);
        cables += `
            <line x1="${targetX + 5}" y1="${trolleyY + 8}" x2="${bx - 12}" y2="${by - 12}" stroke="#f43f5e" stroke-width="2.5" />
            <line x1="${targetX + 10}" y1="${trolleyY + 8}" x2="${bx + 12}" y2="${by - 12}" stroke="#f43f5e" stroke-width="2.5" />
            <!-- Gancho -->
            <rect x="${bx - 16}" y="${by - 16}" width="32" height="10" rx="3" fill="#9f1239" stroke="#f43f5e" stroke-width="1.5" />
            <path d="M ${bx - 18} ${by - 10} L ${bx - 18} ${by + 6} L ${bx - 10} ${by + 6}" fill="none" stroke="#f43f5e" stroke-width="2" />
            <path d="M ${bx + 18} ${by - 10} L ${bx + 18} ${by + 6} L ${bx + 10} ${by + 6}" fill="none" stroke="#f43f5e" stroke-width="2" />
        `;
    }

    craneSvg.innerHTML = trolley + cables;
}

// --- ALGORITMO SELECTION SORT CON MECÁNICA DE GRÚA ---
async function startSelectionSort() {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    btnStart.disabled = true;
    btnReset.disabled = true;

    for (let i = 0; i < NUM_ELEMENTS; i++) {
        let minIdx = i;

        // 1. La grúa baja por el pivote en posición i y lo levanta
        statusText.textContent = `Grúa engancha posición [${i}] (Valor: ${arr[i]}).`;
        playServoSound();
        const blockI = blockElements[i];
        blockI.className = 'block pivot';
        playClankSound();

        // Elevar a la altura de pivote
        moveBlock(i, getSlotX(i), LIFT_Y_PIVOT);
        updateCrane(i, null);
        await sleep(500);

        for (let j = i + 1; j < NUM_ELEMENTS; j++) {
            statusText.textContent = `Buscando: Comparando con valor ${arr[j]} en posición [${j}]...`;
            playCompareSound(arr[j]);

            // Segundo brazo baja y sube el candidato para comparar
            const blockJ = blockElements[j];
            blockJ.className = 'block min';
            moveBlock(j, getSlotX(j), LIFT_Y_MIN);
            updateCrane(i, j);
            await sleep(450);

            if (arr[j] < arr[minIdx]) {
                statusText.textContent = `¡Nuevo mínimo detectado! ${arr[j]} es menor que ${arr[minIdx]}.`;
                playClankSound();

                if (minIdx !== i) {
                    // Si ya teníamos otro mínimo previo, regresarlo a su lugar
                    const prevMin = blockElements[minIdx];
                    prevMin.className = 'block unsorted';
                    moveBlock(minIdx, getSlotX(minIdx), FLOOR_Y - parseFloat(prevMin.dataset.height));
                }
                minIdx = j;
                await sleep(300);
            } else {
                // Si no fue menor, se devuelve a su lugar
                blockJ.className = 'block unsorted';
                moveBlock(j, getSlotX(j), FLOOR_Y - parseFloat(blockJ.dataset.height));
                updateCrane(i, null);
                await sleep(250);
            }
        }

        // 2. Intercambio (Swap) si se halló un número menor
        if (minIdx !== i) {
            statusText.textContent = `Intercambiando bloque ${arr[i]} con el mínimo ${arr[minIdx]}...`;
            playServoSound();

            const xI = getSlotX(i);
            const xMin = getSlotX(minIdx);

            // Cruzar posiciones horizontalmente en el aire
            moveBlock(i, xMin, LIFT_Y_PIVOT);
            moveBlock(minIdx, xI, LIFT_Y_MIN);
            updateCrane(i, minIdx);
            await sleep(650);

            // Bajar ambos al piso en sus nuevas posiciones
            playClankSound();
            moveBlock(minIdx, xI, FLOOR_Y - parseFloat(blockElements[minIdx].dataset.height));
            moveBlock(i, xMin, FLOOR_Y - parseFloat(blockElements[i].dataset.height));

            // Actualizar lógica del arreglo y elementos DOM
            let tempVal = arr[i];
            arr[i] = arr[minIdx];
            arr[minIdx] = tempVal;

            let tempEl = blockElements[i];
            blockElements[i] = blockElements[minIdx];
            blockElements[minIdx] = tempEl;

            blockElements[minIdx].className = 'block unsorted';
            await sleep(300);
        } else {
            // No hubo intercambio, se baja a su lugar
            moveBlock(i, getSlotX(i), FLOOR_Y - parseFloat(blockElements[i].dataset.height));
            await sleep(250);
        }

        // Elemento consolidado en su posición final
        blockElements[i].className = 'block sorted';
        craneSvg.innerHTML = '';
        await sleep(200);
    }

    statusText.textContent = '🎉 ¡Completado! Arreglo ordenado correctamente.';
    playVictory();
    btnStart.disabled = false;
    btnReset.disabled = false;
}

// Iniciar al cargar la ventana
window.onload = initSimulation;
