import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('員工今日頁依手機 GPS 自動更新當日天氣',async()=>{
  const[html,js,css]=await Promise.all([read('mobile.html'),read('assets/mobile.js'),read('assets/mobile-enhancements.css')]);
  assert.match(html,/id="weatherCard"/);
  assert.doesNotMatch(html,/id="weatherUseLocation"/);
  assert.doesNotMatch(html,/id="weatherRefresh"/);
  assert.match(html,/GPS 自動定位天氣/);
  assert.match(html,/home-hero[\s\S]*id="weatherCard"[\s\S]*duty-card/);
  assert.match(html,/mobile-enhancements\.css\?v=14/);
  assert.match(html,/assets\/mobile\.js\?v=37/);
  assert.match(js,/api\.open-meteo\.com\/v1\/forecast/);
  assert.match(js,/forecast_days:'1'/);
  assert.doesNotMatch(js,/class="weather-days"/);
  assert.match(js,/timezone:'Asia\/Taipei'/);
  assert.match(js,/startAutoWeather/);
  assert.match(js,/refreshWeatherFromGps/);
  assert.match(js,/20\*60\*1000/);
  assert.match(js,/await position\(\)/);
  assert.match(css,/\.hero-weather-current/);
  assert.match(css,/\.hero-weather-today/);
});

test('員工 PWA 更新快取版本',async()=>{
  const[worker,standalone,index]=await Promise.all([
    read('employee-service-worker.js'),
    readFile(new URL('../../employee-app/service-worker.js',import.meta.url),'utf8'),
    readFile(new URL('../../employee-app/index.html',import.meta.url),'utf8')
  ]);
  assert.match(worker,/hongjia-employee-pwa-v27/);
  assert.match(standalone,/hongjia-standalone-employee-v17/);
  assert.match(index,/employee-app-v17/);
});
