from flask import Flask, render_template
from flask_socketio import SocketIO, emit

app = Flask(__name__)
# O segredo aqui é o 'eventlet' ou 'gevent' para lidar com múltiplas conexões simultâneas
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('audio_data')
def handle_audio(data):
    # Retransmite o áudio para todos os conectados, exceto para quem enviou
    emit('audio_stream', data, broadcast=True, include_self=False)

if __name__ == '__main__':
    # Rode com: python app.py
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)