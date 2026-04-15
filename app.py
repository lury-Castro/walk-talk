from flask import Flask, request, render_template
from flask_socketio import SocketIO, emit, join_room

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# =========================
# 🔹 Estruturas globais
# =========================
users = {}              # sid -> username
user_rooms = {}         # sid -> room
rooms_clients = {}      # room -> [sid, sid...]

current_speaker = None  # 🔥 controle de quem está falando

# =========================
# 🔹 ROTA PRINCIPAL
# =========================
@app.route('/')
def index():
    return render_template('index.html')

# =========================
# 🔹 Conexão
# =========================
@socketio.on('connect')
def handle_connect():
    print("Usuário conectado:", request.sid)

# =========================
# 🔹 Username
# =========================
@socketio.on('set_username')
def set_username(data):
    users[request.sid] = data['username']
    print(f"{data['username']} entrou")

    emit('username_ok')

# =========================
# 🔹 Entrar em sala
# =========================
@socketio.on('join_room')
def on_join(data):
    if request.sid not in users:
        emit('error', {'msg': 'Defina username primeiro'})
        return

    room = data['room']

    join_room(room)
    user_rooms[request.sid] = room

    if room not in rooms_clients:
        rooms_clients[room] = []

    rooms_clients[room].append(request.sid)

    print(f"{users[request.sid]} entrou na sala {room}")

    emit('user_joined', {
        'user': users.get(request.sid)
    }, room=room)

# =========================
# 🔹 START TALKING
# =========================
@socketio.on('start_talking')
def start_talking():
    global current_speaker

    # 🔥 só bloqueia se outro estiver falando
    if current_speaker and current_speaker != request.sid:
        emit('blocked', {
            'msg': 'Alguém já está falando'
        })
        return

    current_speaker = request.sid

    emit('speaker_update', {
        'user': users.get(request.sid)
    }, broadcast=True)

# =========================
# 🔹 STOP TALKING
# =========================
@socketio.on('stop_talking')
def stop_talking():
    global current_speaker

    if current_speaker == request.sid:
        current_speaker = None

        emit('speaker_update', {
            'user': None
        }, broadcast=True)

# =========================
# 🔹 ÁUDIO (CORRIGIDO)
# =========================
@socketio.on('audio_data')
def handle_audio(data):
    username = users.get(request.sid)

    print("🔥 Recebeu áudio de:", username)

    room = user_rooms.get(request.sid)

    # 🔥 só bloqueia se OUTRO estiver falando
    if current_speaker and current_speaker != request.sid:
        print("⛔ Bloqueado - outro falando")
        return

    emit('audio_stream', {
        'audio': data['audio'],
        'user': username
    }, room=room, include_self=False)

# =========================
# 🔹 Desconexão
# =========================
@socketio.on('disconnect')
def handle_disconnect():
    global current_speaker

    username = users.get(request.sid)
    room = user_rooms.get(request.sid)

    print(f"Usuário desconectado: {username}")

    if current_speaker == request.sid:
        current_speaker = None
        emit('speaker_update', {'user': None}, broadcast=True)

    if room and room in rooms_clients:
        if request.sid in rooms_clients[room]:
            rooms_clients[room].remove(request.sid)

        if len(rooms_clients[room]) == 0:
            del rooms_clients[room]

    users.pop(request.sid, None)
    user_rooms.pop(request.sid, None)

# =========================
# 🔹 Rodar servidor
# =========================
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)