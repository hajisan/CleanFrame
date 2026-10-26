"""Send remote keys to a Samsung Tizen TV over its local WebSocket API.

Standard library only. The TV accepts WebSocket-over-TLS on port 8002 with a
self-signed certificate, so the connection is encrypted but not authenticated:
only the address in `.local/device.json` is contacted.

The first connection shows an Allow prompt on the TV. The token it returns is
kept in `.local/tv-remote-token` (mode 600) so later runs connect silently.

    python3 scripts/tv-remote.py pair
    python3 scripts/tv-remote.py key HOME
    python3 scripts/tv-remote.py key LEFT RIGHT*3 OK
    python3 scripts/tv-remote.py hold ENTER 1.5
    python3 scripts/tv-remote.py text "hello"

This sends input to the TV; it never writes settings. Use it to check what a
key press actually does, not to change configuration.
"""
import argparse
import base64
import json
from pathlib import Path
import socket
import ssl
import struct
import time

ROOT = Path(__file__).resolve().parents[1]
TOKEN_FILE = ROOT / '.local/tv-remote-token'
CLIENT_NAME = 'CleanFrame tools'
PORT = 8002
PAIR_TIMEOUT = 45


class Remote:
    """Enough of RFC 6455 for this API: text frames, ping, pong, close."""

    def __init__(self, host, token=None):
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        raw = socket.create_connection((host, PORT), timeout=10)
        self.sock = context.wrap_socket(raw, server_hostname=host)
        self.buffer = b''
        path = '/api/v2/channels/samsung.remote.control?name=' + base64.b64encode(CLIENT_NAME.encode()).decode()
        if token:
            path += '&token=' + token
        key = base64.b64encode(bytes(range(16))).decode()
        self.sock.sendall((
            f'GET {path} HTTP/1.1\r\nHost: {host}:{PORT}\r\n'
            'Upgrade: websocket\r\nConnection: Upgrade\r\n'
            f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n'
        ).encode())
        head = b''
        while b'\r\n\r\n' not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError('the TV closed the connection during the handshake')
            head += chunk
        head, self.buffer = head.split(b'\r\n\r\n', 1)
        status = head.split(b'\r\n', 1)[0].decode(errors='replace')
        if ' 101 ' not in status:
            raise ConnectionError('the TV refused the connection (' + status.strip() + ')')

    def _send(self, opcode, payload):
        mask = b'\x01\x02\x03\x04'
        length = len(payload)
        if length < 126:
            header = struct.pack('!BB', 0x80 | opcode, 0x80 | length)
        elif length < 1 << 16:
            header = struct.pack('!BBH', 0x80 | opcode, 0x80 | 126, length)
        else:
            header = struct.pack('!BBQ', 0x80 | opcode, 0x80 | 127, length)
        masked = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
        self.sock.sendall(header + mask + masked)

    def send(self, message):
        self._send(0x1, json.dumps(message).encode())

    def _read(self, count):
        while len(self.buffer) < count:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError('the TV closed the connection')
            self.buffer += chunk
        data, self.buffer = self.buffer[:count], self.buffer[count:]
        return data

    def receive(self, deadline):
        # The TV pings regularly, so a per-read timeout alone would never fire
        # while it waits for an answer that does not come.
        message = b''
        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                raise socket.timeout('no answer from the TV')
            self.sock.settimeout(remaining)
            first, second = self._read(2)
            final, opcode, length = first & 0x80, first & 0x0F, second & 0x7F
            if length == 126:
                length = struct.unpack('!H', self._read(2))[0]
            elif length == 127:
                length = struct.unpack('!Q', self._read(8))[0]
            mask = self._read(4) if second & 0x80 else None
            payload = self._read(length)
            if mask:
                payload = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
            if opcode == 0x9:
                self._send(0xA, payload)
                continue
            if opcode == 0xA:
                continue
            if opcode == 0x8:
                raise ConnectionError('the TV closed the connection')
            message += payload
            if final:
                return json.loads(message.decode('utf-8', errors='replace'))

    def close(self):
        try:
            self._send(0x8, b'')
            self.sock.close()
        except OSError:
            pass


def connect(host, token=None, timeout=PAIR_TIMEOUT):
    try:
        remote = Remote(host, token)
    except OSError as error:
        raise SystemExit(f'Could not reach the TV on port {PORT}: {error}')
    deadline = time.time() + timeout
    while True:
        try:
            message = remote.receive(deadline)
        except socket.timeout:
            remote.close()
            raise SystemExit('No answer from the TV. Accept the Allow prompt on the TV, then retry.')
        event = message.get('event')
        if event == 'ms.channel.connect':
            returned = (message.get('data') or {}).get('token')
            if returned and returned != token:
                TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
                TOKEN_FILE.write_text(returned)
                TOKEN_FILE.chmod(0o600)
            remote.sock.settimeout(10)
            return remote
        if event in ('ms.channel.unauthorized', 'ms.channel.timeOut'):
            remote.close()
            raise SystemExit('The TV refused the connection (' + event + '). Choose Allow on the TV, then retry.')


def key_names(specifications):
    for specification in specifications:
        name, _, times = specification.partition('*')
        name = name.upper()
        if not name.startswith('KEY_'):
            name = 'KEY_' + name
        try:
            repeats = int(times or 1)
        except ValueError:
            raise SystemExit('Repeat count must be a number: ' + specification)
        if repeats < 1:
            raise SystemExit('Repeat count must be at least 1: ' + specification)
        for _ in range(repeats):
            yield name


def send_key(remote, key, command='Click'):
    remote.send({'method': 'ms.remote.control', 'params': {
        'Cmd': command, 'DataOfCmd': key, 'Option': 'false', 'TypeOfRemote': 'SendRemoteKey'}})


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--host', help='TV address; defaults to .local/device.json')
    parser.add_argument('--delay', type=float, default=0.6, help='seconds between key presses (default 0.6)')
    commands = parser.add_subparsers(dest='action', required=True)
    commands.add_parser('pair', help='connect and wait for the Allow prompt')
    key = commands.add_parser('key', help='press keys in order; NAME*N repeats')
    key.add_argument('keys', nargs='+')
    hold = commands.add_parser('hold', help='press and hold one key')
    hold.add_argument('key')
    hold.add_argument('seconds', type=float)
    text = commands.add_parser('text', help='type into the on-screen keyboard')
    text.add_argument('value')
    arguments = parser.parse_args()

    config_file = ROOT / '.local/device.json'
    config = json.loads(config_file.read_text()) if config_file.exists() else {}
    host = arguments.host or config.get('host')
    if not host:
        raise SystemExit('Add the TV address to .local/device.json or pass --host.')

    token = TOKEN_FILE.read_text().strip() if TOKEN_FILE.exists() else None
    remote = connect(host, token or None, timeout=PAIR_TIMEOUT if not token else 10)
    try:
        if arguments.action == 'pair':
            print('Connected. Token saved to .local/tv-remote-token.')
        elif arguments.action == 'key':
            keys = list(key_names(arguments.keys))
            for index, name in enumerate(keys):
                send_key(remote, name)
                if index < len(keys) - 1:
                    time.sleep(arguments.delay)
            print('sent:', ' '.join(keys))
        elif arguments.action == 'hold':
            name = next(key_names([arguments.key]))
            send_key(remote, name, 'Press')
            time.sleep(arguments.seconds)
            send_key(remote, name, 'Release')
            print(f'held {name} for {arguments.seconds}s')
        else:
            remote.send({'method': 'ms.remote.control', 'params': {
                'Cmd': base64.b64encode(arguments.value.encode()).decode(),
                'DataOfCmd': 'base64', 'TypeOfRemote': 'SendInputString'}})
            time.sleep(0.5)
            remote.send({'method': 'ms.remote.control', 'params': {'TypeOfRemote': 'SendInputEnd'}})
            print('typed:', arguments.value)
    finally:
        remote.close()


if __name__ == '__main__':
    main()
