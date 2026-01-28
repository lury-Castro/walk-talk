const socket = io();
const btn = document.getElementById('ptt-btn');
const statusText = document.getElementById('status');

let mediaRecorder;
let audioContext;

// 1. Iniciar Áudio ao interagir (Necessário para Chrome/Android)
async function startAudioSystem() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Usamos um formato que quase todos aceitam
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                // Envia o blob para o servidor
                socket.emit('audio_data', event.data);
            }
        };

        statusText.innerText = "Status: Conectado e Pronto!";
    } catch (err) {
        statusText.innerText = "Erro ao acessar microfone!";
        console.error(err);
    }
}

// 2. Tocar o áudio recebido
// Usamos uma técnica de ler o Blob como ArrayBuffer e decodificar
socket.on('audio_stream', async (data) => {
    if (!audioContext) return;

    try {
        // 'data' chega como array de bytes
        const arrayBuffer = await data; 
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
        
        // Toca o beep quando o áudio termina
        source.onended = () => {
            playRogerBeep();
        };
    } catch (e) {
        console.error("Erro ao processar áudio recebido:", e);
    }
});

// 3. Roger Beep
function playRogerBeep() {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.frequency.value = 880;
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.2);
}

// 4. Eventos de Pressionar
btn.onmousedown = () => {
    if (mediaRecorder) {
        mediaRecorder.start(500); // Pedaços maiores (500ms) para facilitar a decodificação
        statusText.innerText = "🎤 FALANDO...";
    }
};

btn.onmouseup = () => {
    if (mediaRecorder) {
        mediaRecorder.stop();
        statusText.innerText = "Status: Pronto";
        playRogerBeep();
    }
};

// Importante para Mobile: Desbloqueia o áudio no primeiro toque
window.addEventListener('click', startAudioSystem, { once: true });
window.addEventListener('touchstart', startAudioSystem, { once: true });