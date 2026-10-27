"""Build, sign, install and launch CleanFrame on the TV in one step.

Reads .local/device.json: {"host": "<TV IP>", "profile": "<signing profile>", "sdk": "<Tizen SDK path>"}.
"profile" defaults to "cleanframe" and "sdk" to ~/tizen-studio. Home/startup settings are untouched.
"""
from pathlib import Path
import ipaddress
import json
import subprocess
import time
import xml.etree.ElementTree as XML

ROOT = Path(__file__).resolve().parents[1]
config_file = ROOT / '.local/device.json'
config = json.loads(config_file.read_text()) if config_file.exists() else {}
host = config.get('host')
if not host:
    raise SystemExit('Add {"host": "<TV IP>"} to .local/device.json.')
ipaddress.ip_address(host)
sdk = Path(config.get('sdk', '~/tizen-studio')).expanduser()
profile = config.get('profile', 'cleanframe')
sdb, cli = sdk / 'tools/sdb', sdk / 'tools/ide/bin/tizen'
if not sdb.exists() or not cli.exists():
    raise SystemExit('Tizen SDK not found at ' + str(sdk) + '. Set "sdk" in .local/device.json.')
manifest = XML.parse(ROOT / 'app/config.xml').getroot()
app_id = manifest.find('{http://tizen.org/ns/widgets}application').get('id')
serial = host + ':26101'


def run(command, ok=None, timeout=120):
    result = subprocess.run([str(c) for c in command], text=True, capture_output=True, timeout=timeout, stdin=subprocess.DEVNULL)
    output = result.stdout + result.stderr
    if result.returncode or (ok and ok not in output):
        print(output)
        raise SystemExit('Failed: ' + ' '.join(str(c) for c in command[:4]))
    return output


print('Building public widget')
run(['python3', ROOT / 'scripts/export-public.py'])
unsigned = ROOT / 'dist/CleanFrame-public-unsigned.wgt'
signed_dir = ROOT / 'dist/signed'
signed_dir.mkdir(exist_ok=True)
print('Signing with profile ' + profile)
run([cli, 'package', '-t', 'wgt', '-s', profile, '-o', signed_dir, '--', unsigned], ok='is created successfully')
widget = ROOT / 'dist/CleanFrame.wgt'
(signed_dir / unsigned.name).replace(widget)

print('Installing on ' + host)
connected = run([sdb, 'connect', serial])
if 'connected to' not in connected and 'already connected' not in connected:
    raise SystemExit('TV connection was not confirmed. Is Developer Mode on?')
remote = '/home/owner/share/tmp/sdk_tools/CleanFrame-' + str(time.time_ns()) + '.wgt'
run([sdb, '-s', serial, 'push', widget, remote], ok='1 file(s) pushed')
# sdb install only uploads on this TV; vd_appinstall performs the install.
run([sdb, '-s', serial, 'shell', '0', 'vd_appinstall', app_id, remote], ok='install completed')
run([sdb, '-s', serial, 'shell', '0', 'execute', app_id], ok='successfully launched')
print('Installed and launched ' + app_id + '.')
