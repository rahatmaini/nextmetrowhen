(function () {
  'use strict';

  var userLocation = null;
  var nearestStation = null;
  var viewMode = 'trains';
  var incidentsList = [];
  var WMATA_API_KEY = '68e098225b2a4dc6b17f3a0cd74bc07e';
  var stationsCache = null;
  var DEFAULT_WEATHER_LAT = 38.9072;
  var DEFAULT_WEATHER_LON = -77.0369;
  /** Station code → name. Cached in station-code-to-name-cache.js, no API call for train destination names. */
  var stationCodeToName = window.STATION_CODE_TO_NAME || {};

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

  function showSuccess(lat, lon) {
    resultErrorEl.setAttribute('hidden', '');
    resultErrorEl.removeAttribute('data-visible');
    resultEl.removeAttribute('hidden');
    resultEl.setAttribute('data-visible', 'true');
    content.setAttribute('data-state', 'success');

    // fetchWeather(lat, lon, function (err, weather) {
    //   var mastheadWeather = document.getElementById('masthead-weather');
    //   var textEl = document.getElementById('masthead-weather-text');
    //   if (err || !weather || !mastheadWeather || !textEl) return;
    //   mastheadWeather.removeAttribute('hidden');
    //   mastheadWeather.removeAttribute('aria-hidden');
    //   setMastheadWeatherIcon(getWeatherIconKey(weather.weatherCode, weather.isNight));
    //   var f = Math.round(celsiusToFahrenheit(weather.temperature));
    //   textEl.textContent = weather.conditions + ', ' + f + ' °F';
    // });

    fetchStations(function (err, stations) {
      if (err || !stations || stations.length === 0) return;
      var result = findNearestStation(lat, lon, stations);
      if (!result) return;
      nearestStation = result;
      fetchAndShowNextTrains(result.station);
    });
  }

  function fetchAndShowNextTrains(station) {
    var container = document.getElementById('result-next-trains');
    if (!container) return;
    var stationCodes = station.Code + (station.StationTogether1 ? ',' + station.StationTogether1 : '');
    var url = 'https://api.wmata.com/StationPrediction.svc/json/GetPrediction/' +
      encodeURIComponent(stationCodes) + '?api_key=' + encodeURIComponent(WMATA_API_KEY);
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var trains = (data.Trains || []).slice(0, 3);
        if (trains.length === 0) {
          container.innerHTML = '';
          container.setAttribute('hidden', '');
          return;
        }
        container.removeAttribute('hidden');
        var html = '';
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
          html += '<div class="next-train-block">';
          html += '<div class="next-train-left">';
          html += '<p class="next-train-line-dest"><span class="next-train-line-circle">' + escapeHtml(lineInitial) + '</span><span class="next-train-dest">' + escapeHtml(dest) + '</span></p>';
          html += '</div>';
          html += '<div class="next-train-right">';
          html += '<p class="next-train-min"><span class="' + numClass + '">' + escapeHtml(String(minNum)) + '</span>';
          if (minLabel) html += ' <span class="next-train-min-label">' + escapeHtml(minLabel) + '</span>';
          html += '</p>';
          html += '</div>';
          if (i < trains.length - 1) html += '<hr class="next-train-divider">';
          html += '</div>';
        });
        container.innerHTML = html;
      })
      .catch(function () {
        container.innerHTML = '';
        container.setAttribute('hidden', '');
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
      timeEl.textContent = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
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
      var finalH1 = document.createElement('h1');
      finalH1.className = 'headline';
      finalH1.id = 'headline';
      finalH1.textContent = incomingText;
      wrap.innerHTML = '';
      wrap.appendChild(finalH1);
      if (onComplete) onComplete();
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
      container.innerHTML = incomingHtml;
      if (onComplete) onComplete();
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
    runHeadlineSlide('Incidents:', 'Next metro in:', 'down', function () {});
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

  var sliderPosition = 0;
  var SLIDER_DEFAULT_HSL_LIGHT = { h: 15, s: 100, l: 96 };
  var SLIDER_DEFAULT_HSL_DARK = { h: 0, s: 8, l: 10 };

  function applySliderToBackground() {
    var body = document.body;
    if (!body) return;
    var isDark = body.getAttribute('data-theme') === 'dark';
    var h = isDark ? (SLIDER_DEFAULT_HSL_DARK.h + sliderPosition * 360) % 360 : (SLIDER_DEFAULT_HSL_LIGHT.h + sliderPosition * 360) % 360;
    var s = isDark ? SLIDER_DEFAULT_HSL_DARK.s : SLIDER_DEFAULT_HSL_LIGHT.s;
    var l = isDark ? SLIDER_DEFAULT_HSL_DARK.l : SLIDER_DEFAULT_HSL_LIGHT.l;
    body.style.backgroundColor = 'hsl(' + Math.round(h) + ', ' + s + '%, ' + l + '%)';
  }

  function applyTheme(theme) {
    var body = document.body;
    if (!body) return;
    if (theme === 'dark') {
      body.setAttribute('data-theme', 'dark');
    } else {
      body.removeAttribute('data-theme');
    }
    updateFlipLightsIcon();
    applySliderToBackground();
  }

  function toggleTheme() {
    var body = document.body;
    var next = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (e) {}
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
    // fetchWeather(DEFAULT_WEATHER_LAT, DEFAULT_WEATHER_LON, function (err, weather) {
    //   var mastheadWeather = document.getElementById('masthead-weather');
    //   var textEl = document.getElementById('masthead-weather-text');
    //   if (err || !weather || !mastheadWeather || !textEl) return;
    //   mastheadWeather.removeAttribute('hidden');
    //   mastheadWeather.removeAttribute('aria-hidden');
    //   setMastheadWeatherIcon(getWeatherIconKey(weather.weatherCode, weather.isNight));
    //   var f = Math.round(celsiusToFahrenheit(weather.temperature));
    //   textEl.textContent = weather.conditions + ', ' + f + ' °F';
    // });
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

  (function initBgSliderPill() {
    var pill = document.getElementById('bg-slider-pill');
    var track = document.querySelector('.masthead-rule');
    if (!pill || !track) return;

    var pillActive = false;
    var PILL_SCALE_ACTIVE = 1.14;

    function updatePillTransform() {
      var scale = pillActive ? PILL_SCALE_ACTIVE : 1;
      pill.style.transform = 'translateX(-50%) scale(' + scale + ')';
    }

    function setPosition(pos) {
      sliderPosition = Math.max(0, Math.min(1, pos));
      pill.style.left = (sliderPosition * 100) + '%';
      updatePillTransform();
      pill.setAttribute('aria-valuenow', Math.round(sliderPosition * 100));
      applySliderToBackground();
    }

    function onMove(clientX) {
      var rect = track.getBoundingClientRect();
      setPosition((clientX - rect.left) / rect.width);
    }

    function onPointerDown(e) {
      e.preventDefault();
      pillActive = true;
      updatePillTransform();
      onMove(e.clientX);
      function onPointerMove(ev) {
        onMove(ev.clientX);
      }
      function onPointerUp() {
        pillActive = false;
        updatePillTransform();
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
      }
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    }

    pill.addEventListener('pointerdown', onPointerDown);

    pill.addEventListener('keydown', function (e) {
      var step = 0.05;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPosition(sliderPosition - step);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPosition(sliderPosition + step);
      }
    });

    setPosition(0);
  })();

  if (allowBtn) allowBtn.addEventListener('click', requestLocation);
  if (tryAgainBtn) {
    tryAgainBtn.addEventListener('click', function () {
      clearState();
      requestLocation();
    });
  }
})();
