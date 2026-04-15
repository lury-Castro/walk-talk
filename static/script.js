const socket = io();
// =========================
// 🔹 TEMA LIGHT/DARK
// =========================
const themeBtn = document.getElementById("theme-toggle");

// carregar preferência salva
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    themeBtn.innerText = "Light ☀️";
}

// clique
themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
        localStorage.setItem("theme", "dark");
        themeBtn.innerText = "Light ☀️";
    } else {
        localStorage.setItem("theme", "light");
        themeBtn.innerText = "Dark 🌙";
    }
});
// =========================
// 🔹 ELEMENTOS UI
// =========================
const usernameInput = document.getElementById("username");
const startBtn = document.getElementById("start-btn");

const loginArea = document.getElementById("login-area");
const radioArea = document.getElementById("radio-area");

const pttBtn = document.getElementById("ptt-btn");
const statusText = document.getElementById("status");
const speakerDisplay = document.getElementById("speaker-display");

// =========================
// 🔹 VARIÁVEIS
// =========================
let mediaRecorder;
let isRecording = false;
let localStream;
let myName = "";
let audioChunks = [];

// =========================
// 🔹 LOGIN
// =========================
startBtn.addEventListener("click", async () => {
    myName = usernameInput.value.trim();

    if (!myName) {
        alert("Digite seu nome");
        return;
    }

    const room = "geral";

    socket.emit("set_username", { username: myName });

    socket.once("username_ok", async () => {

        loginArea.classList.add("hidden");
        radioArea.classList.remove("hidden");

        socket.emit("join_room", { room });

        await initAudio();
    });
});

// =========================
// 🔹 MICROFONE
// =========================
async function initAudio() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        mediaRecorder = new MediaRecorder(localStream, {
            mimeType: "audio/webm;codecs=opus",
            audioBitsPerSecond: 64000
        });

        // 🔴 GUARDA OS PEDAÇOS
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        // 🟢 ENVIA TUDO QUANDO PARA
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: "audio/webm" });
            audioChunks = [];

            const reader = new FileReader();

            reader.onloadend = () => {
                socket.emit("audio_data", {
                    audio: reader.result
                });
            };

            reader.readAsDataURL(blob);

            statusText.innerText = "Pronto";
        };

        console.log("Microfone OK");

    } catch (err) {
        console.error("Erro microfone:", err);
        alert("Erro ao acessar microfone: " + err.message);
    }
}

// =========================
// 🔹 BOTÃO (CLIQUE)
// =========================
pttBtn.addEventListener("click", () => {

    if (!mediaRecorder) return;

    // 🔴 PARAR
    if (isRecording) {
        mediaRecorder.stop();
        isRecording = false;

        statusText.innerText = "Enviando...";
        pttBtn.classList.remove("recording");

        socket.emit("stop_talking");
    }

    // 🟢 GRAVAR
    else {
        audioChunks = []; // limpa antes de começar

        mediaRecorder.start();
        isRecording = true;

        statusText.innerText = "🎤 Gravando... Clique para enviar";
        pttBtn.classList.add("recording");

        socket.emit("start_talking");
    }
});

// =========================
// 🔹 RECEBER ÁUDIO
// =========================
socket.on("audio_stream", (data) => {
    try {
        const audio = new Audio(data.audio);
        audio.play().catch(() => { });

        speakerDisplay.innerText = `📢 ${data.user} falando...`;

        audio.onended = () => {
            speakerDisplay.innerText = "";
        };

    } catch (e) {
        console.error("Erro ao tocar áudio:", e);
    }
});
socket.on("audio_stream", (data) => {
    console.log("Áudio recebido:", data);

    const audio = new Audio(data.audio);

    audio.play()
        .then(() => console.log("Tocando áudio"))
        .catch(err => console.error("Erro ao tocar:", err));
});

// =========================
// 🔹 STATUS DE FALA
// =========================
socket.on("speaker_update", (data) => {
    if (data.user) {
        speakerDisplay.innerText = `📢 ${data.user} falando...`;
    } else {
        speakerDisplay.innerText = "";
    }
});

// =========================
// 🔹 BLOQUEIO
// =========================
socket.on("blocked", (data) => {
    alert(data.msg);
});