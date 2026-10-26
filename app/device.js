/* Public Tizen application APIs. No Mac server, network address or credentials. */
(function () {
  'use strict';
  var IDS = {
    stremio: 'IkWsFHtOY9.Stremio', tv2play: 'FHMMapSZwd.dktv2play', drtv: 'y6N4hjtxfc.DRTV',
    youtube: '9Ur5IzDKqV.TizenYouTube', netflix: 'org.tizen.netflix-app',
    nba: 'lVYJ9MhFJc.NextGenSamsungTizen', source: 'org.tizen.tv-viewer'
  };
  var STREAMING = ['as6cYRgkPy.Binge', '73iTZRTc34.Stan', '5b8c3eb16b.BeamCTVDev',
    'KaLitts8bq.tenplaySamsungTizen', 'eYuOiOLYQX.KayoSports', 'Ne2ZsPWdKl.9NOW',
    '3KA0pm7a7V.TubiTV', 'rJeHak5zRg.Spotify', 'icp4AvUPiA.7plus'];
  var CONSUMER_SYSTEM = ['org.tizen.browser', 'com.microsoft.copilot'];
  var EXTRA_BRANDS = {'rJeHak5zRg.Spotify': 'spotify', '5b8c3eb16b.BeamCTVDev': 'hbomax', '3KA0pm7a7V.TubiTV': 'tubi'};
  var INTERNAL = ['adplatform.ADPlayer', 'WykOS4t4F0.cmsWebApp', '25emanual3.emanual',
    'ZODRT12q2l.WebAccountExtension', 'ByJlgt0XeD.CastSettingsApp', 'tv6pbVMQFF.PrivacyChoices'];
  var SELF = 'XrMjpaNZc5.CleanFrame';
  function api() { return window.tizen && window.tizen.application; }
  function unavailable(done) {
    done({ message: 'Open CleanFrame on the TV to use this control.', detail: 'The web preview cannot control the TV.' });
  }
  function failure(err) {
    return { message: 'The TV could not open this screen.', detail: err && (err.message || err.name) || 'Try again, or press the remote’s Home button to return to CleanFrame.' };
  }
  function bounded(done) {
    var finished = false, timer = setTimeout(function () { finish({ message: 'The TV did not respond. Please try again.' }); }, 8000);
    function finish(err, value) { if (finished) return; finished = true; clearTimeout(timer); done(err, value); }
    return finish;
  }
  var HDMI_PS5 = '1';
  /* HbbTV apps such as DR TV are not startable by their own ID. Samsung publishes
     their entry page as app metadata and starts the shared HbbTV host instead. */
  var HBBTV_HOST = 'org.tizen.hbbtv';
  var HBBTV_LINK = 'http://samsung.com/tv/metadata/hbbtv.link';
  function hbbtvLink(id) {
    try {
      if (!api().getAppMetaData) return '';
      var metadata = api().getAppMetaData(id), i;
      for (i = 0; metadata && i < metadata.length; i++) {
        if (metadata[i] && metadata[i].key === HBBTV_LINK && typeof metadata[i].value === 'string' && metadata[i].value.trim()) return metadata[i].value.trim();
      }
    } catch (err) {}
    return '';
  }
  function launchHbbtv(id, link, done) {
    var finish = bounded(done);
    try {
      var data = [
        new tizen.ApplicationControlData('tizenid', [id]),
        new tizen.ApplicationControlData('hbbtv', [link]),
        new tizen.ApplicationControlData('deeplink', ['true'])
      ];
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
      api().launchAppControl(control, HBBTV_HOST, function () { finish(null); }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  function launchApp(id, done) {
    if (!api()) { unavailable(done); return; }
    if (id === IDS.source) { hdmi(HDMI_PS5, done); return; }
    var link = hbbtvLink(id);
    if (link) { launchHbbtv(id, link, done); return; }
    var finish = bounded(done);
    try { api().launch(id, function () { finish(null); }, function (err) { finish(failure(err)); }); }
    catch (err) { finish(failure(err)); }
  }
  function launch(brand, done) {
    if (!IDS[brand]) { done({message: 'This app has no launch target.'}); return; }
    launchApp(IDS[brand], done);
  }
  /* tv-viewer accepts an input choice through app-control data; confirmed on the TQ43LS03BGU. */
  function hdmi(number, done) {
    var finish = bounded(done);
    try {
      var data = [new tizen.ApplicationControlData('SOURCE', ['HDMI' + number]), new tizen.ApplicationControlData('type', ['HDMI']), new tizen.ApplicationControlData('number', [number])];
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
      api().launchAppControl(control, IDS.source, function () { finish(null); }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  function home(done) { launchApp('com.samsung.tv.csfs', done); }
  function settings(done) { launchApp('org.tizen.menu', done); }
  function apps(done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try {
      api().getAppsInfo(function (list) {
        var known = {}, seen = {}, result = [];
        Object.keys(IDS).forEach(function (brand) { known[IDS[brand]] = brand; });
        list.forEach(function (a) {
          var primary = !!known[a.id], stream = STREAMING.indexOf(a.id) >= 0;
          var consumer = /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/.test(a.id) || CONSUMER_SYSTEM.indexOf(a.id) >= 0;
          if (a.id === SELF || a.id === HBBTV_HOST || a.id === HBBTV_HOST + '-service' || INTERNAL.indexOf(a.id) >= 0 || seen[a.id] || !a.name || (!primary && !stream && (!a.show || !consumer))) return;
          if (!primary && /(?:service|worker|preview|promotion|plugin|launcher|test|sdk|^ep[ -]|factory|daemon)/i.test(a.name + ' ' + a.id)) return;
          if (/-dummy$/.test(a.id) || a.id === 'com.samsung.tv.cobalt-yt') return;
          seen[a.id] = true;
          result.push({ appId: a.id, name: a.name, brand: known[a.id] || EXTRA_BRANDS[a.id] || '', icon: a.iconPath || '', rank: primary ? Object.keys(IDS).indexOf(known[a.id]) : (stream ? 20 : 30) });
        });
        result.sort(function (a, b) { return a.rank - b.rank || a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
        finish(null, result);
      }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  window.FrameDevice = { launch: launch, launchApp: launchApp, home: home, settings: settings, apps: apps };
}());
