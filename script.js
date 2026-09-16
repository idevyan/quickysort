// --- SISTEMA DE AUDIO SINTETIZADO (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type = 'sine', duration = 0.1) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Sonido al comparar
function playBoop(freq) { 
    playTone(freq, 'triangle', 0.08); 
}

// Sonido agudo al encontrar nuevo mínimo
function playNewMinSound() { 
    playTone(880, 'sine', 0.15); 
}

// Sonido deslizante para el intercambio
function playSwapSound() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}

// Melodía triunfal final
function playVictorySound() {
    const notas = [523.25, 659.25, 783.99, 1046.50];
    notas.forEach((frecuencia, i) => {
        setTimeout(() => playTone(frecuencia, 'square', 0.2), i * 120);
    });
}

// --- DINÁMICA DE SELECTION SORT ---
let array = [];
const size = 12;
const container = document.getElementById('array-container');
const statusBox = document.getElementById('status');
const btnSort = document.getElementById('btn-sort');
const btnGen = document.getElementById('btn-generate');

function generateArray() {
    array = [];
    container.innerHTML = '';
    for (let i = 0; i < size; i++) {
        const val = Math.floor(Math.random() * 80) + 15;
        array.push(val);
        const bar = document.createElement('div');
        bar.classList.add('bar');
        bar.style.height = `${val * 2.5}px`;
        bar.textContent = val;
        bar.id = `bar-${i}`;
        container.appendChild(bar);
    }
    statusBox.textContent = '¡Arreglo generado! Presiona "Iniciar Dinámica".';
    playTone(440, 'sine', 0.06);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function selectionSort() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    btnSort.disabled = true;
    btnGen.disabled = true;
    const n = array.length;

    for (let i = 0; i < n; i++) {
        let minIdx = i;
        const barI = document.getElementById(`bar-${i}`);
        barI.classList.add('min');
        statusBox.textContent = `Buscando el menor elemento desde la posición ${i}...`;

        for (let j = i + 1; j < n; j++) {
            const barJ = document.getElementById(`bar-${j}`);
            barJ.classList.add('current');
            playBoop(300 + array[j] * 5);
            await sleep(350);

            if (array[j] < array[minIdx]) {
                if (minIdx !== i) {
                    document.getElementById(`bar-${minIdx}`).classList.remove('min');
                }
                minIdx = j;
                barJ.classList.remove('current');
                barJ.classList.add('min');
                playNewMinSound();
                statusBox.textContent = `¡Nuevo mínimo detectado: ${array[minIdx]}!`;
                await sleep(200);
            } else {
                barJ.classList.remove('current');
            }
        }

        // Intercambiar si se encontró un mínimo diferente
        if (minIdx !== i) {
            statusBox.textContent = `Intercambiando ${array[i]} con ${array[minIdx]}...`;
            playSwapSound();
            await sleep(250);

            let temp = array[i];
            array[i] = array[minIdx];
            array[minIdx] = temp;

            barI.style.height = `${array[i] * 2.5}px`;
            barI.textContent = array[i];

            const barMin = document.getElementById(`bar-${minIdx}`);
            barMin.style.height = `${array[minIdx] * 2.5}px`;
            barMin.textContent = array[minIdx];
            barMin.classList.remove('min');
        }

        barI.classList.remove('min');
        barI.classList.add('sorted');
        await sleep(200);
    }

    statusBox.textContent = '🎉 ¡Completado! Arreglo ordenado exitosamente.';
    playVictorySound();
    btnSort.disabled = false;
    btnGen.disabled = false;
}

// Crear arreglo al cargar la página
window.onload = generateArray;
