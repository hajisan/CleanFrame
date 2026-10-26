/* Check how app/device.js launches ordinary apps and HbbTV apps without a TV. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app/device.js', import.meta.url), 'utf8');
const LINK_KEY = 'http://samsung.com/tv/metadata/hbbtv.link';
const HOST = 'org.tizen.hbbtv';
const LINK = 'https://hbbtv.example/entry?apptype=samsung';
const APP = 'y6N4hjtxfc.DRTV';

function harness(metadata, options = {}) {
  const calls = { meta: [], launch: [], control: [] };
  const tizen = {
    application: {
      getAppMetaData(id) {
        calls.meta.push(id);
        if (metadata instanceof Error) throw metadata;
        return typeof metadata === 'function' ? metadata(id) : metadata;
      },
      launch(id, ok) {
        calls.launch.push(id);
        ok();
      },
      launchAppControl(control, id, ok, fail) {
        /* Array.from keeps the values in this realm so strict comparisons work. */
        calls.control.push({ id, operation: control.operation, data: Array.from(control.data, (item) => [item.key, String(item.value[0])]) });
        if (options.controlFails) fail({ message: 'launch denied' }); else ok();
      }
    },
    ApplicationControlData: function (key, value) {
      this.key = key;
      this.value = value;
    },
    ApplicationControl: function (operation, uri, mime, category, data) {
      this.operation = operation;
      this.uri = uri;
      this.mime = mime;
      this.category = category;
      this.data = data;
    }
  };
  if (options.noMetadata) delete tizen.application.getAppMetaData;
  const context = vm.createContext({
    window: { tizen },
    tizen,
    console,
    setTimeout,
    clearTimeout
  });
  vm.runInContext(source, context);
  return { device: context.window.FrameDevice, calls };
}

function launch(device, id) {
  return new Promise((resolve) => {
    device.launchApp(id, (error) => resolve(error || null));
  });
}

{
  const { device, calls } = harness([{ key: LINK_KEY, value: ` ${LINK} ` }]);
  assert.equal(await launch(device, APP), null, 'HbbTV launch succeeds');
  assert.deepEqual(calls.launch, [], 'HbbTV apps are not started by their own ID');
  assert.equal(calls.control.length, 1);
  assert.equal(calls.control[0].id, HOST, 'the shared HbbTV host is started');
  assert.equal(calls.control[0].operation, 'http://tizen.org/appcontrol/operation/default');
  assert.deepEqual(calls.control[0].data, [['tizenid', APP], ['hbbtv', LINK], ['deeplink', 'true']]);
}

{
  const { device, calls } = harness([]);
  assert.equal(await launch(device, 'IkWsFHtOY9.Stremio'), null, 'ordinary launch succeeds');
  assert.deepEqual(calls.launch, ['IkWsFHtOY9.Stremio']);
  assert.deepEqual(calls.control, []);
}

for (const [name, metadata, options] of [
  ['metadata throws', new Error('denied'), {}],
  ['metadata is missing', [], { noMetadata: true }],
  ['metadata has no link', [{ key: 'other', value: LINK }], {}],
  ['metadata value is empty', [{ key: LINK_KEY, value: '  ' }], {}]
]) {
  const { device, calls } = harness(metadata, options);
  assert.equal(await launch(device, 'normal.app'), null, name);
  assert.deepEqual(calls.launch, ['normal.app'], name + ' falls back to a normal launch');
}

{
  const { device } = harness([{ key: LINK_KEY, value: LINK }], { controlFails: true });
  const error = await launch(device, APP);
  assert.ok(error, 'a failed HbbTV launch is reported');
  assert.match(error.detail, /launch denied/);
}

console.log('App launch routing: passed');
