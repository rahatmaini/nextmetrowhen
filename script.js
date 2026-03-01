(function () {
  'use strict';

  var userLocation = null;
  var nearestStation = null;
  var viewMode = 'trains';
  /** Headline for trains view: "Next metro in:" or "Next metro is:" when first train has non-numeric status */
  var trainsViewHeadline = 'Next metro in:';
  var trainPollIntervalId = null;
  var incidentsList = [];
  var WMATA_API_KEY = '68e098225b2a4dc6b17f3a0cd74bc07e';
  var stationsCache = null;
  var DEFAULT_WEATHER_LAT = 38.9072;
  var DEFAULT_WEATHER_LON = -77.0369;
  /** Station code → name. Cached in station-code-to-name-cache.js, no API call for train destination names. */
  var stationCodeToName = window.STATION_CODE_TO_NAME || {};

  /** SVG-friendly coordinates for each station code (for drawing the metro map). */
  var STATION_COORDINATES = {
    A01: [0, 0], A02: [-0.5, -0.5], A03: [-1, -1], A04: [-2, -2], A05: [-5, -5], A06: [-10, -10], A07: [-25, -25],
    A08: [-50, -50], A09: [-100, -100], A10: [-200, -200], A11: [-300, -300], A12: [-400, -400], A13: [-500, -500],
    A14: [-600, -600], A15: [-700, -700],
    B01: [100, 100], B02: [150, 150], B03: [200, 200], B04: [300, 300], B05: [400, 400], B06: [500, 500], B07: [600, 600],
    B08: [700, 700], B09: [800, 800], B10: [900, 900], B11: [1000, 1000], B35: [200, 200],
    C01: [0, 0], C02: [-25, 0], C03: [-50, 0], C04: [-100, 0], C05: [-200, 0], C06: [150, 25], C07: [150, 50], C08: [150, 75],
    C09: [150, 100], C10: [150, 150], C11: [150, 200], C12: [150, 250], C13: [150, 300], C14: [150, 350], C15: [150, 400],
    D01: [50, 0], D02: [100, 0], D03: [150, 0], D04: [200, 0], D05: [250, 0], D06: [300, 0], D07: [350, 0], D08: [400, 0],
    D09: [500, 0], D10: [600, 0], D11: [700, 0], D12: [800, 0], D13: [900, 0],
    E01: [100, 200], E02: [100, 300], E03: [100, 400], E04: [100, 500], E05: [100, 600], E06: [100, 700], E07: [100, 800],
    E08: [100, 900], E09: [100, 1000], E10: [100, 1100],
    F01: [100, 100], F02: [125, 125], F03: [150, 0], F04: [150, 50], F05: [150, 100], F06: [150, 150], F07: [160, 200],
    F08: [175, 250], F09: [200, 300], F10: [225, 350], F11: [250, 400],
    G01: [450, 50], G02: [550, 100], G03: [650, 150], G04: [750, 200], G05: [850, 250],
    J02: [-800, -50], J03: [-900, -100],
    K01: [-150, 0], K02: [-100, 0], K03: [-75, 0], K04: [-50, 0], K05: [-350, -100], K06: [-400, -100], K07: [-450, -100],
    K08: [-500, -100],
    N01: [-350, 0], N02: [-400, 0], N03: [-450, 0], N04: [-500, 0], N06: [-600, 0], N07: [-700, 0], N08: [-800, 0],
    N09: [-900, 0], N10: [-1000, 0], N11: [-1100, 0], N12: [-1200, 0]
  };

  /** Line sequences for drawing the map (station codes in order along each segment). */
  var MAP_LINE_SEQUENCES = [
    ['A15', 'A14', 'A13', 'A12', 'A11', 'A10', 'A09', 'A08', 'A07', 'A06', 'A05', 'A04', 'A03', 'A02', 'A01'],
    ['B11', 'B10', 'B09', 'B08', 'B07', 'B06', 'B05', 'B04', 'B03', 'B02', 'B35', 'B01'],
    ['C01', 'C02', 'C03', 'C04', 'C05'],
    ['C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15'],
    ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'D11', 'D12', 'D13'],
    ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E10'],
    ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10', 'F11'],
    ['G01', 'G02', 'G03', 'G04', 'G05'],
    ['J02', 'J03'],
    ['K01', 'K02', 'K03', 'K04'],
    ['K05', 'K06', 'K07', 'K08'],
    ['N01', 'N02', 'N03', 'N04'],
    ['N06', 'N07', 'N08', 'N09', 'N10', 'N11', 'N12']
  ];

  var MAP_VIEWBOX = { x: -1250, y: -750, w: 2350, h: 1950 };
  var MAP_SVG_WIDTH = 2350;
  var MAP_SVG_HEIGHT = 1950;

  var lineCodeToName = { RD: 'Red', BL: 'Blue', YL: 'Yellow', OR: 'Orange', GR: 'Green', SV: 'Silver' };

  var allowBtn = document.getElementById('allow-location');
  var tryAgainBtn = document.getElementById('try-again');
  var content = document.querySelector('.content');
  var resultEl = document.getElementById('result');
  var resultWeatherEl = document.getElementById('result-weather');
  var resultErrorEl = document.getElementById('result-error');
  var resultErrorMessage = document.getElementById('result-error-message');

  var weatherCodeLabels = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
  };

  function getWeatherLabel(code) {
    return weatherCodeLabels[code] || 'Unknown';
  }

  function getWeatherIconKey(code, isNight) {
    if (code === 0 || code === 1) return isNight ? 'clear-night' : 'clear';
    if (code === 2) return 'partly-cloudy';
    if (code === 3) return 'overcast';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if (code >= 61 && code <= 67 || code >= 80 && code <= 82) return 'rain';
    if (code >= 71 && code <= 77 || code >= 85 && code <= 86) return 'snow';
    if (code >= 95 && code <= 99) return 'thunderstorm';
    return 'overcast';
  }

  var weatherIcons = {
    clear: '<svg class="weather-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
    'clear-night': '<svg class="weather-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    'partly-cloudy': '<svg class="weather-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="3"/><path d="M9 2v2M9 16v2M3.5 9H5.5M12.5 9h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4"/><path d="M18 14a4 4 0 0 0-5-5 4 4 0 0 0-4 4 3 3 0 0 0 3 3h6a3 3 0 0 0 0-6z"/></svg>',
    overcast: '<svg class="weather-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><path d="M18 14a4 4 0 0 0-5-5 4 4 0 0 0-4 4 3 3 0 0 0 3 3h6a3 3 0 0 0 0-6z"/></svg>',
    fog: '<svg class="weather-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><path d="M4 8h16M4 12h16M4 16h12"/></svg>',
    drizzle: '<svg class="weather-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><path d="M18 14a4 4 0 0 0-5-5 4 4 0 0 0-4 4 3 3 0 0 0 3 3h6a3 3 0 0 0 0-6z"/><path d="M8 18v2M12 18v2M16 18v2"/></svg>',
    rain: '<svg class="weather-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><path d="M18 14a4 4 0 0 0-5-5 4 4 0 0 0-4 4 3 3 0 0 0 3 3h6a3 3 0 0 0 0-6z"/><path d="M7 18l2-4M11 18l2-4M15 18l2-4"/></svg>',
    snow: '<svg class="weather-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><path d="M18 14a4 4 0 0 0-5-5 4 4 0 0 0-4 4 3 3 0 0 0 3 3h6a3 3 0 0 0 0-6z"/><path d="M12 16v-2M10.5 14.5l1.5-1.5M10.5 17.5l1.5 1.5M13.5 14.5l-1.5-1.5M13.5 17.5l-1.5 1.5"/></svg>',
    thunderstorm: '<svg class="weather-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><path d="M18 14a4 4 0 0 0-5-5 4 4 0 0 0-4 4 3 3 0 0 0 3 3h6a3 3 0 0 0 0-6z"/><path d="M13 11l-3 4h2l-2 3 4-5h-2z"/></svg>'
  };

  function setMastheadWeatherIcon(key) {
    var el = document.getElementById('masthead-weather-icon');
    if (!el) return;
    el.innerHTML = weatherIcons[key] || weatherIcons.overcast;
  }

  function minutesFromIsoTime(isoStr) {
    var t = isoStr && isoStr.split('T')[1];
    if (!t) return 0;
    var parts = t.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || 0, 10);
  }

  function isNightAtLocation(sunriseIso, sunsetIso, timeZone) {
    var now = new Date();
    var nowParts = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
    var nowMins = parseInt(nowParts.find(function (p) { return p.type === 'hour'; }).value, 10) * 60 +
      parseInt(nowParts.find(function (p) { return p.type === 'minute'; }).value, 10);
    var sunriseMins = minutesFromIsoTime(sunriseIso);
    var sunsetMins = minutesFromIsoTime(sunsetIso);
    return nowMins < sunriseMins || nowMins > sunsetMins;
  }

  function fetchWeather(lat, lon, callback) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' +
      encodeURIComponent(lat) + '&longitude=' + encodeURIComponent(lon) +
      '&current=temperature_2m,weather_code&daily=sunrise,sunset';
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var current = data.current;
        var daily = data.daily;
        var timeZone = data.timezone || 'UTC';
        if (!current) {
          callback(new Error('No weather data'));
          return;
        }
        var isNight = false;
        if (daily && daily.sunrise && daily.sunrise[0] && daily.sunset && daily.sunset[0]) {
          isNight = isNightAtLocation(daily.sunrise[0], daily.sunset[0], timeZone);
        }
        callback(null, {
          temperature: current.temperature_2m,
          conditions: getWeatherLabel(current.weather_code),
          weatherCode: current.weather_code,
          isNight: isNight
        });
      })
      .catch(function (err) { callback(err); });
  }

  function celsiusToFahrenheit(c) {
    return c * 9 / 5 + 32;
  }

  /** Distance in miles between two points (Haversine). */
  function haversineMiles(lat1, lon1, lat2, lon2) {
    var R = 3959;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function fetchStations(callback) {
    if (stationsCache) {
      callback(null, stationsCache);
      return;
    }
    var url = 'https://api.wmata.com/Rail.svc/json/jStations?api_key=' + encodeURIComponent(WMATA_API_KEY);
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var list = data.Stations || [];
        stationsCache = list;
        callback(null, list);
      })
      .catch(function (err) { callback(err); });
  }

  function populateStationSelect(stations) {
    var sel = document.getElementById('station-select');
    if (!sel || !stations || stations.length === 0) return;
    var sorted = stations.slice().sort(function (a, b) {
      return (a.Name || '').localeCompare(b.Name || '');
    });
    sorted.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.Code || '';
      opt.textContent = s.Name || s.Code || '—';
      sel.appendChild(opt);
    });
  }

  function findNearestStation(lat, lon, stations) {
    var nearest = null;
    var minDist = Infinity;
    for (var i = 0; i < stations.length; i++) {
      var s = stations[i];
      var dist = haversineMiles(lat, lon, s.Lat, s.Lon);
      if (dist < minDist) {
        minDist = dist;
        nearest = { station: s, distanceMiles: dist };
      }
    }
    return nearest;
  }

  function setCurrentStationName(station) {
    var el = document.getElementById('current-station-name');
    if (!el) return;
    el.textContent = (station.Name || station.Code || '').toUpperCase();
    el.removeAttribute('hidden');
  }

  function clearCurrentStationName() {
    var el = document.getElementById('current-station-name');
    if (!el) return;
    el.textContent = '';
    el.setAttribute('hidden', '');
  }

  function showSuccess(lat, lon) {
    resultErrorEl.setAttribute('hidden', '');
    resultErrorEl.removeAttribute('data-visible');
    resultEl.removeAttribute('hidden');
    resultEl.setAttribute('data-visible', 'true');
    content.setAttribute('data-state', 'success');

    fetchStations(function (err, stations) {
      if (err || !stations || stations.length === 0) return;
      var result = findNearestStation(lat, lon, stations);
      if (!result) return;
      nearestStation = result;
      setCurrentStationName(result.station);
      fetchAndShowNextTrains(result.station);
    });
  }

  /** Show train times for a chosen station (from dropdown). */
  function showSuccessForStation(station) {
    resultErrorEl.setAttribute('hidden', '');
    resultErrorEl.removeAttribute('data-visible');
    resultEl.removeAttribute('hidden');
    resultEl.setAttribute('data-visible', 'true');
    content.setAttribute('data-state', 'success');
    nearestStation = { station: station };
    setCurrentStationName(station);
    fetchAndShowNextTrains(station);
  }

  function fetchAndShowNextTrains(station) {
    var container = document.getElementById('result-next-trains');
    if (!container) return;
    if (trainPollIntervalId) {
      clearInterval(trainPollIntervalId);
      trainPollIntervalId = null;
    }
    var stationCodes = station.Code + (station.StationTogether1 ? ',' + station.StationTogether1 : '');
    var url = 'https://api.wmata.com/StationPrediction.svc/json/GetPrediction/' +
      encodeURIComponent(stationCodes) + '?api_key=' + encodeURIComponent(WMATA_API_KEY);
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var all = data.Trains || [];
        var trains = all
          .filter(function (t) {
            var dest = (t.DestinationName || stationCodeToName[t.DestinationCode] || t.Destination || '').toUpperCase();
            return dest !== 'NO PASSENGER';
          })
          .slice(0, 3);
        if (trains.length === 0) {
          container.innerHTML = '';
          container.setAttribute('hidden', '');
          return;
        }
        container.removeAttribute('hidden');
        var firstMin = trains[0] && trains[0].Min;
        var firstIsNumeric = firstMin && firstMin !== 'ARR' && firstMin !== 'BRD' && !isNaN(parseInt(firstMin, 10));
        trainsViewHeadline = firstIsNumeric ? 'Next metro in:' : 'Next metro is:';
        updateTrainsViewHeadline();

        var oldBlocks = container.querySelectorAll('.next-train-block');
        var oldStatusHtmls = [];
        for (var b = 0; b < oldBlocks.length; b++) {
          var minEl = oldBlocks[b].querySelector('.next-train-min');
          if (minEl) oldStatusHtmls.push(minEl.innerHTML);
        }

        var html = '';
        var newStatusHtmls = [];
        trains.forEach(function (t, i) {
          var dest = (t.DestinationName || stationCodeToName[t.DestinationCode] || t.Destination || '—').toUpperCase();
          var lineInitial = (t.Line && t.Line.length > 0) ? String(t.Line).slice(0, 1).toUpperCase() : '—';
          var minNum = t.Min;
          var minLabel = 'min';
          var isNumericMin = false;
          if (minNum === 'ARR') { minNum = 'Arriving'; minLabel = ''; }
          else if (minNum === 'BRD') { minNum = 'Boarding'; minLabel = ''; }
          else if (!minNum) { minNum = '—'; minLabel = ''; }
          else { isNumericMin = true; }
          var numClass = 'next-train-min-num' + (isNumericMin ? ' next-train-min-num--numeric' : '');
          var minInner = '<span class="' + numClass + '">' + escapeHtml(String(minNum)) + '</span>';
          if (minLabel) minInner += ' <span class="next-train-min-label">' + escapeHtml(minLabel) + '</span>';
          newStatusHtmls.push(minInner);
          html += '<div class="next-train-block">';
          html += '<div class="next-train-stack">';
          html += '<p class="next-train-line-dest"><span class="next-train-line-circle">' + escapeHtml(lineInitial) + '</span><span class="next-train-dest">' + escapeHtml(dest) + '</span></p>';
          html += '<p class="next-train-min">' + minInner + '</p>';
          html += '</div>';
          if (i < trains.length - 1) html += '<hr class="next-train-divider">';
          html += '</div>';
        });
        container.innerHTML = html;

        for (var j = 0; j < trains.length; j++) {
          var oldText = oldStatusHtmls[j] !== undefined ? getStatusTextFromHtml(oldStatusHtmls[j]) : '';
          var newText = getStatusTextFromHtml(newStatusHtmls[j]);
          if (oldStatusHtmls[j] !== undefined && oldText !== newText) {
            var blocks = container.querySelectorAll('.next-train-block');
            var minEl = blocks[j] && blocks[j].querySelector('.next-train-min');
            runTrainStatusSlide(minEl, oldStatusHtmls[j], newStatusHtmls[j], function () {});
          }
        }

        trainPollIntervalId = setInterval(function () {
          fetchAndShowNextTrains(station);
        }, 15000);
      })
      .catch(function () {
        container.innerHTML = '';
        container.setAttribute('hidden', '');
        trainPollIntervalId = setInterval(function () {
          fetchAndShowNextTrains(station);
        }, 15000);
      });
  }

  function showError(message) {
    resultEl.setAttribute('hidden', '');
    resultEl.removeAttribute('data-visible');
    resultErrorMessage.textContent = message;
    resultErrorEl.removeAttribute('hidden');
    resultErrorEl.setAttribute('data-visible', 'true');
    content.setAttribute('data-state', 'error');
  }

  function clearState() {
    userLocation = null;
    nearestStation = null;
    if (trainPollIntervalId) {
      clearInterval(trainPollIntervalId);
      trainPollIntervalId = null;
    }
    clearCurrentStationName();
    content.removeAttribute('data-state');
    resultEl.setAttribute('hidden', '');
    resultEl.removeAttribute('data-visible');
    resultErrorEl.setAttribute('hidden', '');
    resultErrorEl.removeAttribute('data-visible');
    // var mastheadWeather = document.getElementById('masthead-weather');
    // if (mastheadWeather) {
    //   mastheadWeather.setAttribute('hidden', '');
    //   mastheadWeather.setAttribute('aria-hidden', 'true');
    //   document.getElementById('masthead-weather-icon').innerHTML = '';
    //   document.getElementById('masthead-weather-text').textContent = '';
    // }
    var nextTrainsEl = document.getElementById('result-next-trains');
    if (nextTrainsEl) {
      nextTrainsEl.innerHTML = '';
      nextTrainsEl.setAttribute('hidden', '');
    }
  }

  function onPositionSuccess(position) {
    var coords = position.coords;
    userLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy
    };
    showSuccess(userLocation.latitude, userLocation.longitude);
  }

  function onPositionError(err) {
    userLocation = null;
    var message = 'We couldn"t get your location. Please check your browser settings or try again.';
    if (err.code === err.PERMISSION_DENIED) {
      message = 'Location access was denied. Enable location for this site to continue.';
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      message = 'Your position could not be determined. Try again in a moment.';
    } else if (err.code === err.TIMEOUT) {
      message = 'The request took too long. Please try again.';
    }
    showError(message);
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(onPositionSuccess, onPositionError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    });
  }

  /** If the user already granted location for this site, restore it without prompting (Safari remembers permission). */
  function tryRestoreLocation() {
    if (!navigator.geolocation || userLocation) return;
    navigator.geolocation.getCurrentPosition(
      onPositionSuccess,
      function () { /* silent: leave button visible */ },
      { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 }
    );
  }

  function updateDateTime() {
    var now = new Date();
    var timeEl = document.getElementById('datetime-time');
    var dateEl = document.getElementById('datetime-date');
    if (timeEl) {
      var h = now.getHours();
      var m = String(now.getMinutes()).padStart(2, '0');
      var s = String(now.getSeconds()).padStart(2, '0');
      var h12 = h % 12;
      if (h12 === 0) h12 = 12;
      var ampm = h < 12 ? 'AM' : 'PM';
      timeEl.textContent = String(h12).padStart(2, '0') + ':' + m + ':' + s + ' ' + ampm;
    }
    if (dateEl) {
      var weekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      var month = now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
      var day = now.getDate();
      var year = now.getFullYear();
      dateEl.textContent = weekday + ' ' + month + ' ' + day + ', ' + year;
    }
  }

  var incidentsTriangleSvg = '<svg class="incidents-triangle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L22 20H2L12 2z"/><path d="M12 8v5"/><circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none"/></svg>';
  var backArrowSvg = '<svg class="incidents-back-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';

  var INCIDENTS_SLIDE_DURATION_MS = 400;
  var HEADLINE_SLIDE_HEIGHT = '1.2em';
  var TRAIN_STATUS_SLIDE_HEIGHT = '5.5rem';

  /** Normalize status HTML to comparable text so we detect real content changes. */
  function getStatusTextFromHtml(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || '').trim().replace(/\s+/g, ' ');
  }

  /** Slide animation for a single train status: old content slides up and out, new content slides up from below. */
  function runTrainStatusSlide(minElement, oldHtml, newHtml, onComplete) {
    if (!minElement) {
      if (onComplete) onComplete();
      return;
    }
    var viewport = document.createElement('div');
    viewport.className = 'train-status-slide-viewport';
    var strip = document.createElement('div');
    strip.className = 'train-status-slide-strip';
    var line1 = document.createElement('div');
    line1.className = 'train-status-slide-line';
    var line2 = document.createElement('div');
    line2.className = 'train-status-slide-line';
    line1.innerHTML = oldHtml;
    line2.innerHTML = newHtml;
    strip.appendChild(line1);
    strip.appendChild(line2);
    strip.style.transform = 'translateY(0)';
    viewport.appendChild(strip);
    minElement.innerHTML = '';
    minElement.appendChild(viewport);
    strip.offsetHeight;
    strip.style.transform = 'translateY(-' + TRAIN_STATUS_SLIDE_HEIGHT + ')';
    var done = function () {
      strip.removeEventListener('transitionend', done);
      requestAnimationFrame(function () {
        minElement.innerHTML = newHtml;
        if (onComplete) onComplete();
      });
    };
    strip.addEventListener('transitionend', done);
    setTimeout(function () {
      if (strip.parentNode) done();
    }, INCIDENTS_SLIDE_DURATION_MS + 50);
  }

  /** Updates the trains-view headline to trainsViewHeadline with slide animation if it changed. */
  function updateTrainsViewHeadline() {
    var wrap = document.getElementById('headline-slide-wrap');
    if (!wrap) return;
    var headlineEl = document.getElementById('headline') || wrap.querySelector('.headline');
    var current = (headlineEl && headlineEl.textContent.trim()) || 'Next metro in:';
    if (current === trainsViewHeadline) return;
    runHeadlineSlide(current, trainsViewHeadline, 'up', function () {});
  }

  function runHeadlineSlide(outgoingText, incomingText, direction, onComplete) {
    var wrap = document.getElementById('headline-slide-wrap');
    if (!wrap) {
      if (onComplete) onComplete();
      return;
    }
    var slideUp = direction === 'up';
    var viewport = document.createElement('div');
    viewport.className = 'headline-slide-viewport';
    var strip = document.createElement('div');
    strip.className = 'headline-slide-strip';
    var line1 = document.createElement('div');
    line1.className = 'headline-slide-line';
    var line2 = document.createElement('div');
    line2.className = 'headline-slide-line';
    var h1 = document.createElement('h1');
    h1.className = 'headline';
    var h2 = document.createElement('h1');
    h2.className = 'headline';
    if (slideUp) {
      h1.textContent = outgoingText;
      h2.textContent = incomingText;
      line1.appendChild(h1);
      line2.appendChild(h2);
      strip.style.transform = 'translateY(0)';
    } else {
      h1.textContent = incomingText;
      h2.textContent = outgoingText;
      line1.appendChild(h1);
      line2.appendChild(h2);
      strip.style.transform = 'translateY(-' + HEADLINE_SLIDE_HEIGHT + ')';
    }
    strip.appendChild(line1);
    strip.appendChild(line2);
    viewport.appendChild(strip);
    wrap.innerHTML = '';
    wrap.appendChild(viewport);
    strip.offsetHeight;
    strip.style.transform = slideUp ? 'translateY(-' + HEADLINE_SLIDE_HEIGHT + ')' : 'translateY(0)';
    var done = function () {
      strip.removeEventListener('transitionend', done);
      requestAnimationFrame(function () {
        var finalH1 = document.createElement('h1');
        finalH1.className = 'headline';
        finalH1.id = 'headline';
        finalH1.textContent = incomingText;
        wrap.innerHTML = '';
        wrap.appendChild(finalH1);
        if (onComplete) onComplete();
      });
    };
    strip.addEventListener('transitionend', done);
    setTimeout(function () {
      if (strip.parentNode) done();
    }, INCIDENTS_SLIDE_DURATION_MS + 50);
  }

  function runIncidentsSlide(container, outgoingHtml, incomingHtml, direction, onComplete) {
    var viewport = document.createElement('div');
    viewport.className = 'incidents-slide-viewport';
    var strip = document.createElement('div');
    strip.className = 'incidents-slide-strip';
    var line1 = document.createElement('div');
    line1.className = 'incidents-slide-line';
    var line2 = document.createElement('div');
    line2.className = 'incidents-slide-line';
    var slideUp = direction === 'up';
    if (slideUp) {
      line1.innerHTML = outgoingHtml;
      line2.innerHTML = incomingHtml;
      strip.appendChild(line1);
      strip.appendChild(line2);
      strip.style.transform = 'translateY(0)';
    } else {
      line1.innerHTML = incomingHtml;
      line2.innerHTML = outgoingHtml;
      strip.appendChild(line1);
      strip.appendChild(line2);
      strip.style.transform = 'translateY(-1.4em)';
    }
    viewport.appendChild(strip);
    container.innerHTML = '';
    container.appendChild(viewport);
    container.removeAttribute('hidden');
    strip.offsetHeight;
    strip.style.transform = slideUp ? 'translateY(-1.4em)' : 'translateY(0)';
    var done = function () {
      strip.removeEventListener('transitionend', done);
      requestAnimationFrame(function () {
        container.innerHTML = incomingHtml;
        if (onComplete) onComplete();
      });
    };
    strip.addEventListener('transitionend', done);
    setTimeout(function () {
      if (strip.parentNode) done();
    }, INCIDENTS_SLIDE_DURATION_MS + 50);
  }

  function showIncidentsView() {
    viewMode = 'incidents';
    var trainsEl = document.getElementById('result-next-trains');
    var incidentsEl = document.getElementById('result-incidents');
    if (trainsEl) { trainsEl.setAttribute('hidden', ''); trainsEl.style.display = 'none'; }
    if (incidentsEl) {
      incidentsEl.removeAttribute('hidden');
      incidentsEl.style.display = 'block';
      renderIncidentsList(incidentsEl);
    }
    var container = document.getElementById('masthead-incidents');
    var btn = document.getElementById('masthead-incidents-btn');
    if (!container || !btn) return;
    btn.disabled = true;
    var outgoingHtml = container.innerHTML;
    var incomingHtml = '<button type="button" class="datetime-incidents-back" id="masthead-incidents-back" aria-label="Back to trains">' +
      '<span class="incidents-icon">' + backArrowSvg + '</span>' +
      '<span class="incidents-back-label">BACK</span></button>';
    runHeadlineSlide('Next metro in:', 'Incidents:', 'up', function () {});
    runIncidentsSlide(container, outgoingHtml, incomingHtml, 'up', function () {
      var backBtn = document.getElementById('masthead-incidents-back');
      if (backBtn) backBtn.addEventListener('click', showTrainsView);
    });
  }

  function showTrainsView() {
    viewMode = 'trains';
    var trainsEl = document.getElementById('result-next-trains');
    var incidentsEl = document.getElementById('result-incidents');
    if (trainsEl) { trainsEl.removeAttribute('hidden'); trainsEl.style.display = ''; }
    if (incidentsEl) { incidentsEl.setAttribute('hidden', ''); incidentsEl.style.display = 'none'; }
    var container = document.getElementById('masthead-incidents');
    var btn = document.getElementById('masthead-incidents-back');
    if (!container || incidentsList.length === 0) {
      renderMastheadIncidents();
      return;
    }
    if (!btn) return;
    btn.disabled = true;
    var outgoingHtml = container.innerHTML;
    var incomingHtml = '<button type="button" class="datetime-incidents-inner datetime-incidents-clickable" id="masthead-incidents-btn" aria-label="View incidents">' +
      '<span class="incidents-icon" aria-hidden="true">' + incidentsTriangleSvg + '</span>' +
      '<span class="incidents-count">' + escapeHtml(String(incidentsList.length)) + ' INCIDENTS</span>' +
      '</button>';
    runHeadlineSlide('Incidents:', trainsViewHeadline, 'down', function () {});
    runIncidentsSlide(container, outgoingHtml, incomingHtml, 'down', function () {
      var incidentsBtn = document.getElementById('masthead-incidents-btn');
      if (incidentsBtn) incidentsBtn.addEventListener('click', showIncidentsView);
    });
  }

  function renderIncidentsList(container) {
    if (!container || !incidentsList.length) return;
    var html = '<ul class="result-incidents-list">';
    incidentsList.forEach(function (inc) {
      var lines = inc.LinesAffected ? inc.LinesAffected.replace(/\s*;\s*/g, ', ').replace(/,\s*$/, '') : '';
      var updated = inc.DateUpdated ? new Date(inc.DateUpdated).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : '';
      html += '<li class="result-incident-item">';
      if (lines) html += '<span class="result-incident-lines">' + escapeHtml(lines) + '</span> ';
      html += '<span class="result-incident-desc">' + escapeHtml(inc.Description || '') + '</span>';
      if (updated) html += ' <span class="result-incident-updated">' + escapeHtml(updated) + '</span>';
      html += '</li>';
    });
    html += '</ul>';
    container.innerHTML = html;
  }

  function renderMastheadIncidents() {
    var container = document.getElementById('masthead-incidents');
    if (!container || incidentsList.length === 0) {
      if (container) { container.setAttribute('hidden', ''); container.innerHTML = ''; }
      return;
    }
    container.removeAttribute('hidden');
    container.innerHTML =
      '<button type="button" class="datetime-incidents-inner datetime-incidents-clickable" id="masthead-incidents-btn" aria-label="View incidents">' +
      '<span class="incidents-icon" aria-hidden="true">' + incidentsTriangleSvg + '</span>' +
      '<span class="incidents-count">' + escapeHtml(String(incidentsList.length)) + ' INCIDENTS</span>' +
      '</button>';
    var btn = document.getElementById('masthead-incidents-btn');
    if (btn) btn.addEventListener('click', showIncidentsView);
  }

  function fetchIncidents() {
    var url = 'https://api.wmata.com/Incidents.svc/json/Incidents?api_key=' + encodeURIComponent(WMATA_API_KEY);
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        incidentsList = data.Incidents || [];
        if (incidentsList.length === 0) {
          var container = document.getElementById('masthead-incidents');
          if (container) { container.setAttribute('hidden', ''); container.innerHTML = ''; }
          return;
        }
        renderMastheadIncidents();
      })
      .catch(function () {
        incidentsList = [];
        var container = document.getElementById('masthead-incidents');
        if (container) { container.setAttribute('hidden', ''); container.innerHTML = ''; }
      });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  var THEME_STORAGE_KEY = 'timeuntilmetro-theme';

  var sunSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  var moonSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function updateFlipLightsIcon() {
    var iconEl = document.getElementById('flip-lights-icon');
    if (!iconEl) return;
    var isDark = document.body.getAttribute('data-theme') === 'dark';
    iconEl.innerHTML = isDark ? sunSvg : moonSvg;
  }

  var PLEASING_HUES_LIGHT = [
    { h: 15, s: 100, l: 96 },
    { h: 270, s: 40, l: 96 },
    { h: 150, s: 40, l: 95 },
    { h: 200, s: 50, l: 95 },
    { h: 350, s: 50, l: 96 },
    { h: 45, s: 70, l: 95 },
    { h: 120, s: 25, l: 94 },
    { h: 320, s: 45, l: 95 },
    { h: 180, s: 35, l: 94 }
  ];
  var PLEASING_HUES_DARK = [
    { h: 15, s: 20, l: 12 },
    { h: 270, s: 15, l: 11 },
    { h: 150, s: 15, l: 11 },
    { h: 200, s: 18, l: 12 },
    { h: 350, s: 18, l: 11 },
    { h: 45, s: 22, l: 12 },
    { h: 120, s: 12, l: 11 },
    { h: 320, s: 16, l: 11 },
    { h: 180, s: 14, l: 11 }
  ];

  function applyColorfulBackground() {
    var body = document.body;
    if (!body) return;
    var isDark = body.getAttribute('data-theme') === 'dark';
    var pal = isDark ? PLEASING_HUES_DARK : PLEASING_HUES_LIGHT;
    var c = pal[Math.floor(Math.random() * pal.length)];
    var newColor = 'hsl(' + c.h + ', ' + c.s + '%, ' + c.l + '%)';
    body.setAttribute('data-colorful', 'true');
    body.style.setProperty('--current-bg', newColor);
    body.style.backgroundColor = newColor;
  }

  function applyTheme(theme) {
    var body = document.body;
    if (!body) return;
    if (theme === 'dark') {
      body.setAttribute('data-theme', 'dark');
    } else {
      body.removeAttribute('data-theme');
    }
    body.removeAttribute('data-colorful');
    body.style.backgroundColor = '';
    body.style.removeProperty('--current-bg');
    updateFlipLightsIcon();
  }

  function toggleTheme() {
    var body = document.body;
    var next = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (e) {}
  }

  function buildMetroMapSvg() {
    var vb = MAP_VIEWBOX;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
    svg.setAttribute('width', String(MAP_SVG_WIDTH));
    svg.setAttribute('height', String(MAP_SVG_HEIGHT));
    svg.setAttribute('class', 'wmata-map-svg');
    svg.setAttribute('aria-hidden', 'true');

    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    var style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = '.wmata-map-line { fill: none; stroke: currentColor; stroke-width: 8; stroke-linecap: round; stroke-linejoin: round; } .wmata-map-station { fill: currentColor; }';
    defs.appendChild(style);
    svg.appendChild(defs);

    var gLines = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gLines.setAttribute('class', 'wmata-map-lines');
    MAP_LINE_SEQUENCES.forEach(function (codes) {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      var d = '';
      codes.forEach(function (code, i) {
        var pt = STATION_COORDINATES[code];
        if (!pt) return;
        var cmd = i === 0 ? 'M' : 'L';
        d += cmd + pt[0] + ',' + pt[1] + ' ';
      });
      path.setAttribute('d', d.trim());
      path.setAttribute('class', 'wmata-map-line');
      gLines.appendChild(path);
    });
    svg.appendChild(gLines);

    var gStations = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gStations.setAttribute('class', 'wmata-map-stations');
    Object.keys(STATION_COORDINATES).forEach(function (code) {
      var pt = STATION_COORDINATES[code];
      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(pt[0]));
      circle.setAttribute('cy', String(pt[1]));
      circle.setAttribute('r', '12');
      circle.setAttribute('class', 'wmata-map-station');
      gStations.appendChild(circle);
    });
    svg.appendChild(gStations);

    return svg;
  }

  var MAP_CONTENT_WIDTH = 1100;
  var MAP_CONTENT_HEIGHT = 800;

  function initMapPanZoom() {
    var viewport = document.getElementById('wmata-map-viewport');
    var inner = document.getElementById('wmata-map-inner');
    if (!viewport || !inner) return;

    var scale = 0.24;
    var panX = 0;
    var panY = 0;
    var minScale = 0.12;
    var maxScale = 2;
    var isDragging = false;
    var startX = 0;
    var startY = 0;
    var startPanX = 0;
    var startPanY = 0;
    var lastViewportWidth = 0;
    var lastViewportHeight = 0;

    function applyTransform() {
      inner.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
    }

    function fitMapToViewport() {
      var rect = viewport.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      var scaleToFit = Math.min(rect.width / MAP_CONTENT_WIDTH, rect.height / MAP_CONTENT_HEIGHT);
      scale = Math.min(maxScale, Math.max(minScale, scaleToFit));
      panX = (rect.width - MAP_CONTENT_WIDTH * scale) / 2;
      panY = (rect.height - MAP_CONTENT_HEIGHT * scale) / 2;
      lastViewportWidth = rect.width;
      lastViewportHeight = rect.height;
      applyTransform();
    }

    function adjustMapForResize() {
      var rect = viewport.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (lastViewportWidth <= 0 || lastViewportHeight <= 0) {
        fitMapToViewport();
        return;
      }
      var contentCenterX = (lastViewportWidth / 2 - panX) / scale;
      var contentCenterY = (lastViewportHeight / 2 - panY) / scale;
      panX = rect.width / 2 - contentCenterX * scale;
      panY = rect.height / 2 - contentCenterY * scale;
      lastViewportWidth = rect.width;
      lastViewportHeight = rect.height;
      applyTransform();
    }

    viewport.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = viewport.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var contentX = (mx - panX) / scale;
      var contentY = (my - panY) / scale;
      var factor = e.deltaY > 0 ? 0.9 : 1.1;
      var newScale = Math.min(maxScale, Math.max(minScale, scale * factor));
      panX = mx - contentX * newScale;
      panY = my - contentY * newScale;
      scale = newScale;
      applyTransform();
    }, { passive: false });

    viewport.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = panX;
      startPanY = panY;
      viewport.setPointerCapture(e.pointerId);
    });

    viewport.addEventListener('pointermove', function (e) {
      if (!isDragging) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      applyTransform();
    });

    viewport.addEventListener('pointerup', function (e) {
      if (e.button !== 0) return;
      isDragging = false;
      viewport.releasePointerCapture(e.pointerId);
    });

    viewport.addEventListener('pointercancel', function () {
      isDragging = false;
    });

    window.addEventListener('resize', function () {
      requestAnimationFrame(adjustMapForResize);
    });

    requestAnimationFrame(function () { fitMapToViewport(); });
  }

  function init() {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    try {
      var saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark') applyTheme('dark');
      else updateFlipLightsIcon();
    } catch (e) {}
    fetchIncidents();
    initMapPanZoom();
    fetchStations(function (err, stations) {
      if (!err && stations) populateStationSelect(stations);
    });
    tryRestoreLocation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  var themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
    themeToggle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleTheme();
      }
    });
  }

  var colorfulBtn = document.getElementById('colorful-btn');
  if (colorfulBtn) {
    colorfulBtn.addEventListener('click', applyColorfulBackground);
    colorfulBtn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        applyColorfulBackground();
      }
    });
  }

  if (allowBtn) allowBtn.addEventListener('click', requestLocation);

  var checkStationBtn = document.getElementById('check-station');
  if (checkStationBtn) {
    checkStationBtn.addEventListener('click', function () {
      var sel = document.getElementById('station-select');
      var code = sel && sel.value ? sel.value.trim() : '';
      if (!code) return;
      if (!stationsCache) {
        fetchStations(function (err, stations) {
          if (err || !stations) return;
          var station = stations.filter(function (s) { return (s.Code || '') === code; })[0];
          if (station) showSuccessForStation(station);
        });
        return;
      }
      var station = stationsCache.filter(function (s) { return (s.Code || '') === code; })[0];
      if (station) showSuccessForStation(station);
    });
  }

  if (tryAgainBtn) {
    tryAgainBtn.addEventListener('click', function () {
      clearState();
      requestLocation();
    });
  }
})();
