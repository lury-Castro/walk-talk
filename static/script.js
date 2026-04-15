// =========================
// 🔹 SOCKET (RECONEXÃO)
// =========================
const socket = io({
    reconnection: true,
    reconnectionAttempts: 999,
    reconnectionDelay: 1000
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

const themeBtn = document.getElementById("theme-toggle");

// =========================
// 🔹 VARIÁVEIS
// =========================
let mediaRecorder;
let isRecording = false;
let localStream;
let myName = "";
let audioChunks = [];

// =========================
// 🔹 TEMA
// =========================
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    themeBtn.innerText = "Light ☀️";
}

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
// 🔹 AUTO LOGIN
// =========================
window.addEventListener("load", () => {
    const savedUser = localStorage.getItem("username");

    if (savedUser) {
        usernameInput.value = savedUser;
        startBtn.click();
    }
});
    
// =========================
// 🔹 LOGOUT
// =========================
const logoutBtn = document.getElementById("logout-btn");
logoutBtn.addEventListener("click", () => {

    // parar gravação se estiver falando
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
    }

    // avisar servidor
    socket.emit("stop_talking");

    // limpar dados
    localStorage.removeItem("username");

    // reset variáveis
    myName = "";
    audioChunks = [];

    // voltar tela
    radioArea.classList.add("hidden");
    loginArea.classList.remove("hidden");

    // limpar campo
    usernameInput.value = "";

    // reset UI
    speakerDisplay.innerText = "";
    statusText.innerText = "Pronto";

    // 🔥 força reconexão limpa
    socket.disconnect();
    socket.connect();
});

// =========================
// 🔹 LOGIN
// =========================
startBtn.addEventListener("click", async () => {

    myName = usernameInput.value.trim();

    if (!myName) {
        alert("Digite seu nome");
        return;
    }

    // 💾 SALVA USUÁRIO
    localStorage.setItem("username", myName);

    const room = "geral";

    socket.emit("set_username", { username: myName });

    socket.once("username_ok", async () => {

        loginArea.classList.add("hidden");
        radioArea.classList.remove("hidden");

        socket.emit("join_room", { room });

        await initAudio();

        // 🔓 libera áudio no mobile
        const unlock = new Audio();
        unlock.play().catch(() => {});
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

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

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

            statusText.innerText = "📢 Clique para gravar";
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

    if (isRecording) {
        mediaRecorder.stop();
        isRecording = false;

        statusText.innerText = "Enviando...";
        pttBtn.classList.remove("recording");

        socket.emit("stop_talking");
    } else {
        audioChunks = [];

        mediaRecorder.start();
        isRecording = true;

        statusText.innerText = "🎤 Gravando...";
        pttBtn.classList.add("recording");

        socket.emit("start_talking");
    }
});

// =========================
// 🔹 NOTIFICAÇÃO
// =========================
if (Notification.permission !== "granted") {
    Notification.requestPermission();
}

// =========================
// 🔹 RECEBER ÁUDIO
// =========================
socket.on("audio_stream", (data) => {
    console.log("Áudio recebido:", data);

    const audio = new Audio(data.audio);

    audio.play().catch(() => {});

    speakerDisplay.innerText = `📢 ${data.user} falando...`;

    audio.onended = () => {
        speakerDisplay.innerText = "";
    };

    // 🔔 notificação se estiver em segundo plano
    if (document.hidden) {
        new Notification("Adar Talk", {
            body: `${data.user} enviou um áudio`
        });
    }
});

// =========================
// 🔹 STATUS DE FALA
// =========================
socket.on("speaker_update", (data) => {
    if (data.user) {
        speakerDisplay.innerText = `📢 ${data.user} gravando...`;
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