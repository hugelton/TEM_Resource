// The Earth Module - UI v2 JavaScript

(function() {
    'use strict';

    // Configuration from backend
    const config = window.TEM_CONFIG || {};
    
    // Debug config
    console.log('TEM_CONFIG received:', config);
    
    // Set API endpoint
    config.apiEndpoint = config.baseUrl || window.location.origin;

    // Slew and motion parameters need firmware 1.3.0+, which is the first to send cvSlew.
    // Older firmware ignores params >= 15 and would freeze that output.
    // Read lazily: the firmware page defines TEM_DATA after this script tag.
    const firmwareHasMotion = () => Array.isArray((window.TEM_DATA || {}).cvSlew);
    const MOTION_MIN_VERSION = '1.3.0';
    const UPDATE_WIZARD_URL = 'https://updater.hugelton.com/TEM/';
    
    // Ensure deviceID exists
    if (!config.deviceID) {
        console.warn('Device ID not received from backend');
        config.deviceID = 'unknown';
    }
    
    // State
    let currentData = {
        cvValues: [0, 0],
        gateValues: [0, 0],
        cvParams: [0, 1],  // Temperature, Humidity
        cvSlew: [0, 0],    // Seconds for a full 0-5V sweep
        gateParams: [8, 3], // Rain/Snow, Wind
        temperature: '-',
        humidity: '-',
        pressure: '-',
        windSpeed: '-',
        visibility: '-',
        cloudCover: '-',
        dewPoint: '-',
        uvIndex: '-',
        rain1h: 0,
        snow1h: 0,
        moonPhase: 0.5,
        solarElevation: '-',
        solarWindSpeed: '-',
        kpIndex: '-',
        latitude: 35.6762,
        longitude: 139.6503,
        cityName: 'Tokyo',
        hasOpenWeatherKey: false,
        hasNasaKey: false,
        bridgeEnabled: false,
        requiresUserApiKey: true,
        weatherMode: 'openweather',
        connectionStatus: 'offline'
    };

    // API connection state
    let apiConnected = true;
    let apiFailureCount = 0;
    let mapInitialized = false;

    // Parameter definitions
    const parameters = {
        cv: [
            { id: 0, name: 'Temperature', unit: '°C', range: [-10, 40], category: 'weather' },
            { id: 1, name: 'Humidity', unit: '%', range: [0, 100], category: 'weather' },
            { id: 2, name: 'Pressure', unit: 'hPa', range: [950, 1050], category: 'weather' },
            { id: 3, name: 'Wind Speed', unit: 'm/s', range: [0, 20], category: 'weather' },
            { id: 4, name: 'Visibility', unit: 'km', range: [0, 10], category: 'weather' },
            { id: 5, name: 'Cloud Cover', unit: '%', range: [0, 100], category: 'weather' },
            { id: 6, name: 'Dew Point', unit: '°C', range: [-20, 30], category: 'weather', isNew: true },
            { id: 7, name: 'UV Index', unit: '', range: [0, 11], category: 'weather', isNew: true },
            { id: 10, name: 'Moon Phase', unit: '', range: [0, 1], category: 'celestial' },
            { id: 11, name: 'Solar Elevation', unit: '°', range: [-90, 90], category: 'celestial' },
            { id: 12, name: 'Solar Wind', unit: 'km/s', range: [250, 800], category: 'space', isNew: true },
            { id: 13, name: 'Kp Index', unit: '', range: [0, 9], category: 'space', isNew: true },
            { id: 15, name: 'Wind LFO', unit: '', range: [0, 1], category: 'motion', isNew: true },
            { id: 16, name: 'Sky Drift', unit: '', range: [0, 1], category: 'motion', isNew: true },
            { id: 17, name: 'Pressure Trend', unit: 'hPa', range: [-3, 3], category: 'motion', isNew: true },
            { id: 18, name: 'Temp Trend', unit: '°C', range: [-2, 2], category: 'motion', isNew: true },
            { id: 19, name: 'Day Cycle', unit: '', range: [0, 1], category: 'motion', isNew: true }
        ],
        gate: [
            { id: 8, name: 'Rain/Snow', logic: '>1mm ON, <0.2mm OFF', category: 'weather' },
            { id: 3, name: 'Wind', logic: '>10m/s ON, <7m/s OFF', category: 'weather' },
            { id: 11, name: 'Day/Night', logic: '>0° ON, <-5° OFF', category: 'celestial' },
            { id: 13, name: 'Storm', logic: 'Kp>5 ON, Kp<4 OFF', category: 'space', isNew: true },
            { id: 14, name: 'Flare', logic: 'M+ ON, C- OFF', category: 'space', isNew: true },
            { id: 20, name: 'Wind Gusts', logic: 'random triggers, more with wind', category: 'motion', isNew: true },
            { id: 21, name: 'Rain Drops', logic: 'random triggers, more with rain/humidity', category: 'motion', isNew: true },
            { id: 17, name: 'Pressure Falling', logic: '<-1hPa/30min ON, >-0.5 OFF', category: 'motion', isNew: true },
            { id: 15, name: 'Wind Clock', logic: 'square wave, rate follows wind', category: 'motion', isNew: true }
        ]
    };

    let map = null;
    let marker = null;
    let updateInterval = null;

    // Initialize
    function init() {
        console.log('TEM UI v2 Initializing...');
        
        // Build UI
        buildInterface();
        
        // Initialize map
        initMap();
        
        // Start data updates
        startUpdates();
        
        // Attach event handlers
        attachEventHandlers();
        
        // Hide loading, show app
        const loading = document.getElementById('loading');
        const app = document.getElementById('app');
        if (loading) loading.style.display = 'none';
        if (app) app.style.display = 'block';
    }

    // Build the interface
    function buildInterface() {
        const app = document.getElementById('app');
        if (!app) return;
        
        app.innerHTML = `
            <div class="header">
                <div>
                    <h1>THE EARTH MODULE DASHBOARD</h1>
                </div>
                <div class="header-controls">
                    <span>Connection<span class="status-dot ${currentData.connectionStatus === 'connected' ? 'online' : 'offline'}" id="connection-status"></span></span>
                    <span>API<span class="status-dot ${currentData.hasOpenWeatherKey ? 'online' : 'offline'}" id="api-status"></span></span>
                    <a href="https://documents.hugelton.com/TEM/" target="_blank" class="btn-docs">📖 Documentation</a>
                </div>
            </div>
            
            <!-- 1. CV/GATE Outputs -->
            <div class="section">
                <div class="section-header">
                    <span class="section-title">CV / GATE Outputs</span>
                </div>
                <div class="update-banner" id="update-banner" style="display: none;"></div>
                <div class="outputs-grid">
                    ${buildCVOutputs()}
                    ${buildGateOutputs()}
                </div>
            </div>
            
            <!-- 2. Location Map -->
            <div class="section">
                <div class="section-header">
                    <span class="section-title">Location</span>
                </div>
                <div class="map-controls">
                    <input type="text" placeholder="Search city..." id="city-search">
                    <button onclick="searchCity()">Search</button>
                    <button onclick="getCurrentLocation()" ${window.location.protocol !== 'https:' ? 'disabled title="GPS requires HTTPS connection"' : ''}>📍 GPS</button>
                    <button onclick="setAsDefault()" class="btn-default">⭐ Set as Default</button>
                </div>
                <div id="map"></div>
                <div class="map-info">
                    <span><strong id="location">${currentData.cityName}</strong></span>
                    <span><strong id="coords">${currentData.latitude.toFixed(4)}°, ${currentData.longitude.toFixed(4)}°</strong></span>
                    <span style="color: #444;">Right-click to pin</span>
                </div>
            </div>
            
            <!-- 3. Environmental Data -->
            <div class="section">
                <div class="section-header">
                    <span class="section-title">Environmental Data</span>
                </div>
                <div class="weather-grid">
                    ${buildWeatherTiles()}
                </div>
            </div>
            
            <!-- 4. Configuration -->
            <div class="section">
                <div class="section-header">
                    <span class="section-title">Configuration</span>
                </div>
                <div class="config-grid">
                    ${buildConfigSection()}
                </div>
            </div>
        `;
    }

    // Build CV outputs
    function buildCVOutputs() {
        let html = '';
        for (let i = 0; i < 2; i++) {
            const voltage = currentData.cvValues[i] === 0 ? '0.00' : (currentData.cvValues[i] * 5).toFixed(2);
            const param = parameters.cv.find(p => p.id === currentData.cvParams[i]) || parameters.cv[0];
            const actualValue = getActualParameterValue(currentData.cvParams[i]);
            
            html += `
                <div class="output-card">
                    <div class="output-type">CV ${i + 1}</div>
                    <div class="output-value" id="cv${i + 1}-value">${voltage}V</div>
                    <div class="output-actual" id="cv${i + 1}-actual">${actualValue}</div>
                    <div class="output-bar">
                        <div class="output-fill" id="cv${i + 1}-bar" style="width: ${currentData.cvValues[i] * 100}%"></div>
                    </div>
                    <canvas class="output-scope" id="cv${i + 1}-scope" aria-label="CV ${i + 1} last 30 seconds"></canvas>
                    <select class="param-select" data-output="cv${i}" onchange="updateParam('cv', ${i}, this.value)">
                        ${buildCVOptions(currentData.cvParams[i])}
                    </select>
                    ${buildSlewRow(i)}
                </div>
            `;
        }
        return html;
    }

    function buildSlewRow(i) {
        if (!firmwareHasMotion()) {
            return `
                <div class="slew-row slew-locked">
                    <label>Slew</label>
                    <a href="${UPDATE_WIZARD_URL}" target="_blank">Update firmware to v${MOTION_MIN_VERSION}+</a>
                </div>
            `;
        }
        return `
            <div class="slew-row">
                <label for="cv${i + 1}-slew">Slew</label>
                <input type="number" class="slew-input" id="cv${i + 1}-slew" min="0" max="600" step="0.5"
                       value="${currentData.cvSlew[i]}" onchange="updateSlew(${i}, this.value)">
                <span>s / 0-5V</span>
            </div>
        `;
    }

    // Motion options stay visible on old firmware so users know what an update brings
    function buildOption(p, selected, detail) {
        const locked = p.category === 'motion' && !firmwareHasMotion();
        const badge = locked ? ` (v${MOTION_MIN_VERSION}+)` : (p.isNew ? ' ●NEW' : '');
        const style = p.isNew && !locked ? 'color: #000 !important; background: #00ff88 !important; font-weight: bold !important;' : '';
        return `<option value="${p.id}" ${p.id === selected ? 'selected' : ''} ${locked ? 'disabled' : ''} style="${style}">
                        ${p.name} [${detail}]${badge}
                    </option>`;
    }

    // Build Gate outputs
    function buildGateOutputs() {
        let html = '';
        for (let i = 0; i < 2; i++) {
            const state = currentData.gateValues[i] > 0.5;
            const actualValue = getActualParameterValue(currentData.gateParams[i]);
            
            html += `
                <div class="output-card">
                    <div class="output-type">GATE ${i + 1}</div>
                    <div class="output-value ${state ? 'gate-high' : 'gate-low'}" id="gate${i + 1}-value">
                        ${state ? 'HIGH' : 'LOW'}
                    </div>
                    <div class="output-actual" id="gate${i + 1}-actual">${actualValue}</div>
                    <div class="output-bar">
                        <div class="output-fill" id="gate${i + 1}-bar" style="width: ${state ? '100' : '0'}%"></div>
                    </div>
                    <canvas class="output-scope" id="gate${i + 1}-scope" aria-label="GATE ${i + 1} last 30 seconds"></canvas>
                    <select class="param-select" data-output="gate${i}" onchange="updateParam('gate', ${i}, this.value)">
                        ${buildGateOptions(currentData.gateParams[i])}
                    </select>
                </div>
            `;
        }
        return html;
    }

    // Build CV parameter options
    function buildCVOptions(selected) {
        let html = '';
        const categories = { weather: '── Weather ──', celestial: '── Celestial ──', space: '── Space ──', motion: '── Motion ──' };
        
        for (const [cat, label] of Object.entries(categories)) {
            const params = parameters.cv.filter(p => p.category === cat);
            if (params.length > 0) {
                html += `<optgroup label="${label}">`;
                params.forEach(p => {
                    html += buildOption(p, selected, `${p.range[0]},${p.range[1]}${p.unit}`);
                });
                html += '</optgroup>';
            }
        }
        return html;
    }

    // Build Gate parameter options
    function buildGateOptions(selected) {
        let html = '<optgroup label="── Gate Logic ──">';
        parameters.gate.forEach(p => {
            html += buildOption(p, selected, p.logic);
        });
        html += '</optgroup>';
        return html;
    }

    // Build weather tiles
    function buildWeatherTiles() {
        const tiles = [
            { key: 'temperature', label: 'Temperature', unit: '°C', decimals: 1 },
            { key: 'humidity', label: 'Humidity', unit: '%', decimals: 0 },
            { key: 'pressure', label: 'Pressure', unit: 'hPa', decimals: 0 },
            { key: 'windSpeed', label: 'Wind', unit: 'm/s', decimals: 1 },
            { key: 'visibility', label: 'Visibility', unit: 'km', decimals: 1 },
            { key: 'cloudCover', label: 'Clouds', unit: '%', decimals: 0 },
            { key: 'uvIndex', label: 'UV Index', unit: '', decimals: 0 },
            { key: 'moonPhase', label: 'Moon', unit: '', transform: getMoonIcon },
            { key: 'solarElevation', label: 'Sun Angle', unit: '°', decimals: 0 },
            { key: 'solarWindSpeed', label: 'Solar Wind', unit: 'km/s', decimals: 0 },
            { key: 'kpIndex', label: 'Kp Index', unit: '', decimals: 0 },
            { key: 'dewPoint', label: 'Dew Point', unit: '°C', decimals: 1 }
        ];
        
        let html = '';
        tiles.forEach(tile => {
            const value = currentData[tile.key];
            let displayValue = '-';
            
            if (value !== '-' && value !== undefined && value !== null) {
                if (tile.transform) {
                    displayValue = tile.transform(value);
                } else if (typeof value === 'number') {
                    displayValue = value.toFixed(tile.decimals);
                } else {
                    displayValue = value;
                }
            }
            
            html += `
                <div class="weather-tile">
                    <h4>${tile.label}</h4>
                    <div class="value" id="${tile.key}-value">
                        ${displayValue}${tile.unit ? `<span class="unit">${tile.unit}</span>` : ''}
                    </div>
                </div>
            `;
        });
        
        return html;
    }

    // Build configuration section
    function buildConfigSection() {
        const apiKeyControls = currentData.requiresUserApiKey ? `
                <div class="api-key-row">
                    <input type="password" id="openweather-key" placeholder="OpenWeather API Key"
                           value="${currentData.hasOpenWeatherKey ? '••••••••••••' : ''}">
                    ${currentData.hasOpenWeatherKey ? '<button class="btn-delete" onclick="deleteAPIKey(\'openweather\')" title="Delete API Key">🗑️</button>' : ''}
                </div>
                <button class="btn-primary" onclick="saveAPIKeys()">Save Keys</button>
        ` : `
                <div class="info-text">Weather: <strong>Managed by TEM Bridge</strong></div>
                <div class="info-text">User API key: <strong>Not required</strong></div>
        `;

        return `
            <div class="config-group">
                <h3>${currentData.requiresUserApiKey ? 'API Keys' : 'Weather Service'}</h3>
                ${apiKeyControls}
            </div>
            <div class="config-group">
                <h3>Network</h3>
                <div class="info-text">Device: <strong class="device-name">tem-${config.deviceID || 'unknown'}.local</strong></div>
                <div class="info-text">SSID: <strong id="wifi-ssid">-</strong></div>
                <div class="info-text">IP: <strong id="wifi-ip">-</strong></div>
                <div class="info-text">Signal: <strong id="wifi-signal">-</strong></div>
                <button class="btn-danger" onclick="resetWiFi()" style="margin-top: 10px;">Reset WiFi</button>
            </div>
            <div class="config-group">
                <h3>System</h3>
                <div class="info-text">Version: <strong id="firmware-version">-</strong></div>
                <div class="info-text">Flash: <strong id="flash-usage">-</strong></div>
                <div class="info-text">Uptime: <strong id="uptime">-</strong></div>
                <div style="margin-top: 10px;">
                    <button class="btn-primary" onclick="checkForUpdates()" style="width: 100%; margin-bottom: 8px; position: relative;" id="update-button">
                        Check for Updates
                        <span class="update-notification" id="update-dot" style="display: none;"></span>
                    </button>
                    <button class="btn-danger" onclick="restartDevice()" style="width: 100%;">Restart</button>
                </div>
            </div>
        `;
    }

    // Get moon phase icon
    function getMoonIcon(phase) {
        const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
        const index = Math.round(phase * 7);
        return icons[index] || '🌕';
    }

    // Initialize map
    function initMap() {
        if (typeof L === 'undefined') {
            console.log('Leaflet not available - retrying in 1 second');
            setTimeout(initMap, 1000);
            return;
        }
        
        const mapEl = document.getElementById('map');
        if (!mapEl) {
            console.log('Map element not found - retrying in 500ms');
            setTimeout(initMap, 500);
            return;
        }
        
        // Check if map is already initialized
        if (map) {
            console.log('Map already initialized');
            return;
        }
        
        // Use saved location if available, otherwise use current data
        const lat = currentData.latitude || 35.6762;
        const lng = currentData.longitude || 139.6503;
        
        try {
            console.log('Initializing map at:', lat, lng);
            
            map = L.map('map', {
                center: [lat, lng],
                zoom: 10,
                zoomControl: true,
                attributionControl: false
            });
            
            // High contrast dark map - Stadia Alidade Smooth Dark
            L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
                attribution: '© Stadia Maps © OpenStreetMap',
                maxZoom: 20,
                minZoom: 2,
                tileSize: 256,
                crossOrigin: true
            }).addTo(map);
            
            // Force a resize after initialization
            setTimeout(() => {
                if (map) {
                    map.invalidateSize();
                    console.log('Map size invalidated');
                }
            }, 100);
        } catch (e) {
            console.error('Map initialization error:', e);
            // Try again in 1 second
            setTimeout(initMap, 1000);
            return;
        }
        
        // Create custom green flat marker icon
        const greenIcon = L.divIcon({
            html: '<div style="background: #00ff88; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #000; box-shadow: 0 0 0 2px #00ff88;"></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15],
            className: 'custom-marker'
        });
        
        // Current marker with custom icon (use same lat/lng as map)
        marker = L.marker([lat, lng], {icon: greenIcon}).addTo(map);
        
        // Map interactions
        map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            updateLocation(e.latlng.lat, e.latlng.lng);
        });
        
        // Right-click to pin
        map.on('contextmenu', function(e) {
            L.DomEvent.preventDefault(e);
            marker.setLatLng(e.latlng);
            updateLocation(e.latlng.lat, e.latlng.lng, true);
            marker.bindPopup('Location pinned').openPopup();
            setTimeout(() => marker.closePopup(), 2000);
        });
    }

    // Update location
    function updateLocation(lat, lng, save = false) {
        currentData.latitude = lat;
        currentData.longitude = lng;
        
        // Update display
        const coordsEl = document.getElementById('coords');
        if (coordsEl) {
            coordsEl.textContent = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
        }
        
        // Reverse geocode
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
            .then(r => r.json())
            .then(data => {
                if (data && data.address) {
                    const city = data.address.city || data.address.town || data.address.village || 'Unknown';
                    const country = data.address.country || '';
                    currentData.cityName = city;
                    
                    const locationEl = document.getElementById('location');
                    if (locationEl) {
                        locationEl.textContent = `${city}, ${country}`;
                    }
                } else {
                    console.warn('No address data in geocoding response');
                }
            })
            .catch(err => console.error('Geocoding error:', err));
        
        // Save to device if requested
        if (save) {
            fetch(`${config.apiEndpoint}/api/location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `lat=${lat}&lng=${lng}`
            }).then(response => {
                if (response.ok) {
                    showNotification('Location saved', 'success');
                }
            }).catch(err => console.error('Location save error:', err));
        }
    }

    // Search city
    window.searchCity = function() {
        const query = document.getElementById('city-search').value;
        if (!query) return;
        
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`)
            .then(r => r.json())
            .then(data => {
                if (data && data[0]) {
                    const lat = parseFloat(data[0].lat);
                    const lng = parseFloat(data[0].lon);
                    map.setView([lat, lng], 10);
                    marker.setLatLng([lat, lng]);
                    updateLocation(lat, lng, true);
                }
            })
            .catch(err => console.error('Search error:', err));
    };

    // Set current location as default
    window.setAsDefault = function() {
        console.log('Setting default location:', currentData.latitude, currentData.longitude);
        
        // Send location to device to save (using URL parameters as firmware expects)
        const params = new URLSearchParams({
            lat: currentData.latitude,
            lng: currentData.longitude
        });
        
        fetch(`${config.apiEndpoint}/api/location?${params}`, {
            method: 'POST'
        })
        .then(response => response.text())
        .then(data => {
            if (data === 'Location updated') {
                // Show confirmation
                const btn = document.querySelector('.btn-default');
                if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = '✅ Saved!';
                    btn.style.background = 'rgba(0,255,136,0.3)';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = '';
                    }, 2000);
                }
                console.log('Default location saved successfully');
            }
        })
        .catch(err => console.error('Failed to save default location:', err));
    };

    // Get current location
    window.getCurrentLocation = function() {
        // Check if HTTPS connection is required
        if (window.location.protocol !== 'https:') {
            showNotification('GPS requires HTTPS connection', 'error');
            return;
        }
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 10);
                marker.setLatLng([lat, lng]);
                updateLocation(lat, lng, true);
            }, function(error) {
                showNotification('Location access denied', 'error');
            });
        } else {
            showNotification('Geolocation not supported', 'error');
        }
    };

    // Update parameter assignment
    window.updateParam = function(type, index, value) {
        const paramId = parseInt(value);
        console.log(`🔧 updateParam() called: ${type.toUpperCase()}${index + 1} → param ${paramId}`);
        
        if (type === 'cv') {
            const oldParam = currentData.cvParams[index];
            currentData.cvParams[index] = paramId;
            console.log(`📝 CV${index + 1} param changed: ${oldParam} → ${paramId}`);
            
            // Update the actual value display immediately
            const actualEl = document.getElementById(`cv${index + 1}-actual`);
            if (actualEl) {
                const oldActual = actualEl.textContent;
                const newActual = getActualParameterValue(paramId);
                actualEl.textContent = newActual;
                console.log(`🏷️ CV${index + 1} actual immediately updated: "${oldActual}" → "${newActual}"`);
            }
        } else if (type === 'gate') {
            const oldParam = currentData.gateParams[index];
            currentData.gateParams[index] = paramId;
            console.log(`📝 GATE${index + 1} param changed: ${oldParam} → ${paramId}`);
            
            // Update the actual value display immediately
            const actualEl = document.getElementById(`gate${index + 1}-actual`);
            if (actualEl) {
                const oldActual = actualEl.textContent;
                const newActual = getActualParameterValue(paramId);
                actualEl.textContent = newActual;
                console.log(`🏷️ GATE${index + 1} actual immediately updated: "${oldActual}" → "${newActual}"`);
            }
        }
        
        // Send to device
        const data = new URLSearchParams();
        data.append(`${type}${index + 1}`, paramId);
        
        fetch(`${config.apiEndpoint}/api/params`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data
        }).then(response => {
            if (response.ok) {
                showNotification(`${type.toUpperCase()} ${index + 1} updated`, 'success');
            }
        }).catch(err => console.error('Param update error:', err));
    };

    // Update CV slew time (seconds for a full 0-5V sweep, 0 = off)
    window.updateSlew = function(index, value) {
        const seconds = Math.min(600, Math.max(0, parseFloat(value) || 0));
        currentData.cvSlew[index] = seconds;
        const input = document.getElementById(`cv${index + 1}-slew`);
        if (input) input.value = seconds;

        const data = new URLSearchParams();
        data.append(`cv${index + 1}slew`, seconds);

        fetch(`${config.apiEndpoint}/api/params`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data
        }).then(response => {
            if (response.ok) {
                showNotification(`CV ${index + 1} slew ${seconds}s`, 'success');
            }
        }).catch(err => console.error('Slew update error:', err));
    };

    // Save API keys
    // Delete API key function
    window.deleteAPIKey = function(keyType) {
        if (!confirm(`Delete ${keyType === 'openweather' ? 'OpenWeather' : 'NASA'} API key?`)) {
            return;
        }
        
        const data = new URLSearchParams();
        data.append(keyType, 'DELETE');
        
        fetch(`${config.apiEndpoint}/api/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data
        }).then(response => {
            if (response.ok) {
                showNotification(`${keyType === 'openweather' ? 'OpenWeather' : 'NASA'} key deleted`, 'success');
                if (keyType === 'openweather') {
                    currentData.hasOpenWeatherKey = false;
                    document.getElementById('openweather-key').value = '';
                } else {
                    currentData.hasNasaKey = false;
                    document.getElementById('nasa-key').value = '';
                }
                // Refresh the config section to update buttons
                const configGrid = document.querySelector('.config-grid');
                if (configGrid) {
                    configGrid.innerHTML = buildConfigSection();
                }
                updateAPIStatus();
            } else {
                showNotification('Failed to delete API key', 'error');
            }
        }).catch(err => {
            console.error('API key delete error:', err);
            showNotification('Failed to delete API key', 'error');
        });
    };
    
    window.saveAPIKeys = function() {
        if (!currentData.requiresUserApiKey) {
            showNotification('Weather is managed by TEM Bridge', 'info');
            return;
        }

        const keyInput = document.getElementById('openweather-key');
        const weatherKey = keyInput ? keyInput.value : '';
        
        if (!weatherKey || weatherKey === '••••••••••••') {
            showNotification('Please enter OpenWeather API key', 'error');
            return;
        }
        
        const data = new URLSearchParams();
        data.append('openweather', weatherKey);
        
        fetch(`${config.apiEndpoint}/api/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data
        }).then(response => {
            if (response.ok) {
                showNotification('API keys saved', 'success');
                currentData.hasOpenWeatherKey = true;
                updateAPIStatus();
            } else {
                showNotification('Failed to save API keys', 'error');
            }
        }).catch(err => {
            console.error('API key save error:', err);
            showNotification('Failed to save API keys', 'error');
        });
    };

    // Reset WiFi
    window.resetWiFi = function() {
        if (!confirm('Reset WiFi settings? Device will restart in AP mode.')) return;
        
        fetch(`${config.apiEndpoint}/api/reset-wifi`, {
            method: 'POST'
        }).then(() => {
            showNotification('WiFi reset. Device restarting...', 'success');
        }).catch(err => {
            console.error('WiFi reset error:', err);
            showNotification('Failed to reset WiFi', 'error');
        });
    };

    // Restart device
    window.restartDevice = function() {
        if (!confirm('Restart device?')) return;
        
        fetch(`${config.apiEndpoint}/api/restart`, {
            method: 'POST'
        }).then(() => {
            showNotification('Device restarting...', 'success');
        }).catch(err => {
            console.error('Restart error:', err);
        });
    };

    // Check for OTA updates
    window.checkForUpdates = function() {
        const button = document.querySelector('button[onclick="checkForUpdates()"]');
        if (button) {
            button.textContent = 'Checking...';
            button.disabled = true;
        }
        
        fetch(`${config.apiEndpoint}/api/check-update`)
            .then(response => response.json())
            .then(data => {
                if (button) {
                    button.textContent = 'Check for Updates';
                    button.disabled = false;
                }
                
                // Check for updates via Update Wizard
                if (data.checkUrl) {
                    fetch(data.checkUrl)
                        .then(response => response.json())
                        .then(remoteData => {
                            console.log('Remote data:', remoteData);
                            console.log('Device data:', data);
                            
                            // Client-side version comparison
                            const currentVersion = data.currentVersion;
                            const latestVersion = remoteData.version;
                            
                            console.log(`🔍 Manual check: Current=${currentVersion}, Latest=${latestVersion}`);
                            const comparison = compareVersions(currentVersion, latestVersion);
                            console.log(`📊 Manual check comparison result: ${comparison}`);
                            hideUpdateDot(); // Hide dot when manually checking
                            
                            if (comparison === 1) {
                                console.log(`✅ Manual check: Update available`);
                                if (confirm(`New version ${latestVersion} available. Current: ${currentVersion}. Open Update Wizard?`)) {
                                    window.open(data.updateWizardUrl, '_blank');
                                }
                            } else if (comparison === -1) {
                                console.log(`❌ Manual check: Current is newer`);
                                showNotification(`Current version ${currentVersion} is newer than remote ${latestVersion}`, 'info');
                            } else {
                                console.log(`🟰 Manual check: Same version`);
                                showNotification('No updates available', 'info');
                            }
                        })
                        .catch(() => {
                            // Fallback: always open wizard
                            if (confirm('Check for updates via Update Wizard?')) {
                                window.open(data.updateWizardUrl, '_blank');
                            }
                        });
                } else {
                    showNotification('Update wizard not available', 'error');
                }
            })
            .catch(err => {
                console.error('Update check error:', err);
                if (button) {
                    button.textContent = 'Check for Updates';
                    button.disabled = false;
                }
                showNotification('Failed to check for updates', 'error');
            });
    };

    // Compare semantic versions (e.g., "1.2.1" vs "1.2.0")
    function compareVersions(current, latest) {
        console.log(`🔍 compareVersions: "${current}" vs "${latest}"`);
        
        const currentParts = current.split('.').map(Number);
        const latestParts = latest.split('.').map(Number);
        
        console.log(`📊 Parsed: current=[${currentParts.join(',')}] latest=[${latestParts.join(',')}]`);
        
        for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
            const currentPart = currentParts[i] || 0;
            const latestPart = latestParts[i] || 0;
            
            console.log(`🔢 Part ${i}: current=${currentPart} latest=${latestPart}`);
            
            if (latestPart > currentPart) {
                console.log(`✅ Update available: ${latestPart} > ${currentPart}`);
                return 1;  // Update available
            }
            if (latestPart < currentPart) {
                console.log(`❌ Current newer: ${currentPart} > ${latestPart}`);
                return -1; // Current is newer
            }
        }
        console.log(`🟰 Same version`);
        return 0; // Same version
    }

    // Silent update check for red dot notification
    function checkForUpdatesQuietly() {
        fetch(`${config.apiEndpoint}/api/check-update`)
            .then(response => response.json())
            .then(data => {
                if (data.checkUrl) {
                    fetch(data.checkUrl)
                        .then(response => response.json())
                        .then(remoteData => {
                            // Client-side version comparison
                            const currentVersion = data.currentVersion;
                            const latestVersion = remoteData.version;
                            
                            console.log(`Version check: Current=${currentVersion}, Latest=${latestVersion}`);
                            
                            const comparison = compareVersions(currentVersion, latestVersion);
                            if (comparison === 1) {
                                showUpdateDot();
                                showUpdateBanner(currentVersion, latestVersion, remoteData.updateUrl || data.updateWizardUrl);
                                console.log(`Update available: ${currentVersion} → ${latestVersion}`);
                            } else if (comparison === -1) {
                                console.log(`Current version ${currentVersion} is newer than remote ${latestVersion}`);
                            } else {
                                console.log(`Version ${currentVersion} is up to date`);
                            }
                        })
                        .catch(err => {
                            console.log('Silent update check failed:', err);
                        });
                }
            })
            .catch(err => {
                console.log('Silent update check failed:', err);
            });
    }

    function showUpdateBanner(currentVersion, latestVersion, url) {
        const banner = document.getElementById('update-banner');
        if (!banner) return;
        banner.innerHTML = `Firmware v${latestVersion} is available (this module: v${currentVersion}).
            <a href="${url || UPDATE_WIZARD_URL}" target="_blank">Open Update Assistant →</a>`;
        banner.style.display = 'block';
    }

    // Show/hide update notification dot
    function showUpdateDot() {
        const dot = document.getElementById('update-dot');
        if (dot) dot.style.display = 'block';
    }

    function hideUpdateDot() {
        const dot = document.getElementById('update-dot');
        if (dot) dot.style.display = 'none';
    }

    // OTA functionality removed - Update Wizard handles updates

    // API key status management
    function updateApiKeyStatus() {
        const weatherSection = document.querySelector('.weather-grid')?.closest('.section');
        const outputsSection = document.querySelector('.outputs-grid')?.closest('.section');
        const locationSection = document.querySelector('#map')?.closest('.section');
        
        if (!currentData.requiresUserApiKey || currentData.hasOpenWeatherKey) {
            // Weather is available through TEM Bridge or a user API key.
            [weatherSection, outputsSection, locationSection].forEach(section => {
                if (section) {
                    section.classList.remove('api-key-missing');
                }
            });
        } else {
            // API key missing - add missing class to all dependent sections.
            [weatherSection, outputsSection, locationSection].forEach(section => {
                if (section) {
                    section.classList.add('api-key-missing');
                }
            });
        }
    }

    // API connection management
    function updateApiConnectionStatus(connected) {
        if (connected) {
            apiFailureCount = 0;
            apiConnected = true;
            
            // Remove disconnected class from all controllable sections
            document.querySelectorAll('.api-disconnected').forEach(element => {
                element.classList.remove('api-disconnected');
            });
            
            // Update status indicator
            const statusDot = document.querySelector('.status-dot');
            if (statusDot) {
                statusDot.classList.add('online');
                statusDot.classList.remove('offline');
            }
        } else {
            apiFailureCount++;
            
            // After 3 consecutive failures, mark as disconnected
            if (apiFailureCount >= 3) {
                apiConnected = false;
                
                // Add disconnected class to controllable sections
                const outputsSection = document.querySelector('.outputs-grid')?.closest('.section');
                const mapSection = document.querySelector('.map-controls')?.closest('.section');
                const configSection = document.querySelector('.config-grid')?.closest('.section');
                
                [outputsSection, mapSection, configSection].forEach(section => {
                    if (section) {
                        section.classList.add('api-disconnected');
                    }
                });
                
                // Update status indicator
                const statusDot = document.querySelector('.status-dot');
                if (statusDot) {
                    statusDot.classList.add('offline');
                    statusDot.classList.remove('online');
                }
            }
        }
    };

    // Fetch data from device
    function fetchData() {
        Promise.all([
            fetch(`${config.apiEndpoint}/api/cv`).then(r => r.json()).catch(() => null),
            fetch(`${config.apiEndpoint}/api/weather`).then(r => r.json()).catch(() => null),
            fetch(`${config.apiEndpoint}/api/status`).then(r => r.json()).catch(() => null)
        ]).then(([cvData, weatherData, statusData]) => {
            // Update API connection status
            updateApiConnectionStatus(true);
            
            // Update connection status
            currentData.connectionStatus = 'connected';
            updateConnectionStatus();
            
            // Update weather data first to get parameters
            if (weatherData) {
                Object.assign(currentData, weatherData);
                updateWeatherDisplays();
                updateApiKeyStatus(); // Check API key status
            }
            
            // Update CV/GATE values after weather data
            if (cvData) {
                currentData.cvValues = [cvData.cv1 || 0, cvData.cv2 || 0];
                currentData.gateValues = [cvData.gate1 || 0, cvData.gate2 || 0];
                // Parameters already set from weatherData above
                updateOutputDisplays();
            }
            
            // Update device info
            if (statusData) {
                if (statusData.deviceID) {
                    config.deviceID = statusData.deviceID;
                    // Update device ID display
                    const deviceSpans = document.querySelectorAll('.device-info span:first-child');
                    deviceSpans.forEach(span => {
                        if (span.textContent.includes('Device:')) {
                            span.textContent = `Device: tem-${statusData.deviceID}`;
                        }
                    });
                }
                updateDeviceInfo(statusData);
            }
            
            // API key status is now only fetched once at startup
        }).catch(error => {
            console.error('Fetch error:', error);
            
            // Update API connection status
            updateApiConnectionStatus(false);
            
            currentData.connectionStatus = 'offline';
            updateConnectionStatus();
        });
    }

    // Update output displays
    function updateOutputDisplays() {
        console.log('🔄 updateOutputDisplays() called');
        console.log('Current data:', {
            cvValues: currentData.cvValues,
            cvParams: currentData.cvParams,
            gateValues: currentData.gateValues,
            gateParams: currentData.gateParams
        });
        
        // Update CV displays
        for (let i = 0; i < 2; i++) {
            const valueEl = document.getElementById(`cv${i + 1}-value`);
            const actualEl = document.getElementById(`cv${i + 1}-actual`);
            const barEl = document.getElementById(`cv${i + 1}-bar`);
            
            const voltage = (currentData.cvValues[i] * 5).toFixed(2);
            const actualValue = getActualParameterValue(currentData.cvParams[i]);
            
            if (valueEl) {
                const oldValue = valueEl.textContent;
                const newValue = `${voltage}V`;
                if (oldValue !== newValue) {
                    console.log(`📊 CV${i + 1} output-value changed: "${oldValue}" → "${newValue}"`);
                }
                valueEl.textContent = newValue;
            }
            if (actualEl) {
                const oldActual = actualEl.textContent;
                if (oldActual !== actualValue) {
                    console.log(`🏷️ CV${i + 1} output-actual changed: "${oldActual}" → "${actualValue}" (param: ${currentData.cvParams[i]})`);
                }
                actualEl.textContent = actualValue;
            }
            if (barEl) {
                barEl.style.width = `${currentData.cvValues[i] * 100}%`;
            }
        }
        
        // Update Gate displays
        for (let i = 0; i < 2; i++) {
            const valueEl = document.getElementById(`gate${i + 1}-value`);
            const actualEl = document.getElementById(`gate${i + 1}-actual`);
            const barEl = document.getElementById(`gate${i + 1}-bar`);
            const state = currentData.gateValues[i] > 0.5;
            
            const actualValue = getActualParameterValue(currentData.gateParams[i]);
            
            if (valueEl) {
                const oldValue = valueEl.textContent;
                const newValue = state ? 'HIGH' : 'LOW';
                if (oldValue !== newValue) {
                    console.log(`⚡ GATE${i + 1} output-value changed: "${oldValue}" → "${newValue}"`);
                }
                valueEl.textContent = newValue;
                valueEl.className = `output-value ${state ? 'gate-high' : 'gate-low'}`;
            }
            if (actualEl) {
                const oldActual = actualEl.textContent;
                if (oldActual !== actualValue) {
                    console.log(`🏷️ GATE${i + 1} output-actual changed: "${oldActual}" → "${actualValue}" (param: ${currentData.gateParams[i]})`);
                }
                actualEl.textContent = actualValue;
            }
            if (barEl) {
                barEl.style.width = state ? '100%' : '0%';
            }
        }
        
        // Update parameter select values to match server data
        updateParameterSelects();
        
        console.log('✅ updateOutputDisplays() completed');
    }
    
    // Update parameter select boxes to match current data
    function updateParameterSelects() {
        console.log('🔄 updateParameterSelects() called');
        
        // Update CV parameter selects
        for (let i = 0; i < 2; i++) {
            const selectEl = document.querySelector(`select[data-output="cv${i}"]`);
            if (selectEl && selectEl.value != currentData.cvParams[i]) {
                const oldValue = selectEl.value;
                selectEl.value = currentData.cvParams[i];
                console.log(`📋 CV${i + 1} select updated: ${oldValue} → ${currentData.cvParams[i]}`);
            }
        }
        
        // Update Gate parameter selects  
        for (let i = 0; i < 2; i++) {
            const selectEl = document.querySelector(`select[data-output="gate${i}"]`);
            if (selectEl && selectEl.value != currentData.gateParams[i]) {
                const oldValue = selectEl.value;
                selectEl.value = currentData.gateParams[i];
                console.log(`📋 GATE${i + 1} select updated: ${oldValue} → ${currentData.gateParams[i]}`);
            }
        }
    }

    // Get actual parameter value
    function getActualParameterValue(paramId) {
        const paramMap = {
            0: { value: currentData.temperature, unit: '°C' },  // Temperature
            1: { value: currentData.humidity, unit: '%' },      // Humidity
            2: { value: currentData.pressure, unit: 'hPa' },    // Pressure
            3: { value: currentData.windSpeed, unit: 'm/s' },   // Wind Speed
            4: { value: currentData.visibility, unit: 'km' },   // Visibility
            5: { value: currentData.cloudCover, unit: '%' },    // Cloud Cover
            6: { value: currentData.dewPoint, unit: '°C' },     // Dew Point
            7: { value: currentData.uvIndex, unit: '' },        // UV Index
            8: { value: (currentData.rain1h || 0) + (currentData.snow1h || 0), unit: 'mm' }, // Rain/Snow
            10: { value: currentData.moonPhase * 100, unit: '%' }, // Moon Phase
            11: { value: currentData.solarElevation, unit: '°' },  // Solar Elevation
            12: { value: currentData.solarWindSpeed, unit: 'km/s' }, // Solar Wind
            13: { value: currentData.kpIndex, unit: '' },       // Kp Index
            17: { value: currentData.pressureTrend, unit: 'hPa' },    // Pressure Trend
            18: { value: currentData.temperatureTrend, unit: '°C' },  // Temp Trend
            19: { value: currentData.dayCycle * 100, unit: '%' }      // Day Cycle
        };
        
        const param = paramMap[paramId];
        if (!param || param.value === undefined || param.value === '-') {
            return '---';
        }
        
        const val = typeof param.value === 'number' ? param.value.toFixed(1) : param.value;
        return `${val}${param.unit}`;
    }
    
    // Update weather displays
    function updateWeatherDisplays() {
        const updates = {
            'temperature-value': currentData.temperature,
            'humidity-value': currentData.humidity,
            'pressure-value': currentData.pressure,
            'windSpeed-value': currentData.windSpeed,
            'visibility-value': currentData.visibility,
            'cloudCover-value': currentData.cloudCover,
            'uvIndex-value': currentData.uvIndex,
            'dewPoint-value': currentData.dewPoint,
            'solarElevation-value': currentData.solarElevation,
            'solarWindSpeed-value': currentData.solarWindSpeed,
            'kpIndex-value': currentData.kpIndex
        };
        
        for (const [id, value] of Object.entries(updates)) {
            const el = document.getElementById(id);
            if (el && value !== '-' && value !== undefined) {
                el.textContent = typeof value === 'number' ? value.toFixed(1) : value;
            }
        }
        
        // Update moon phase
        const moonEl = document.getElementById('moonPhase-value');
        if (moonEl) {
            moonEl.textContent = getMoonIcon(currentData.moonPhase);
        }
    }

    // Update connection status
    function updateConnectionStatus() {
        const dot = document.getElementById('connection-status');
        if (dot) {
            dot.className = `status-dot ${currentData.connectionStatus === 'connected' ? 'online' : 'offline'}`;
        }
    }

    // Update API status
    function updateAPIStatus() {
        const dot = document.getElementById('api-status');
        if (dot) {
            const serviceReady = !currentData.requiresUserApiKey || currentData.hasOpenWeatherKey;
            dot.className = `status-dot ${serviceReady ? 'online' : 'offline'}`;
        }
    }

    // Update device info
    function updateDeviceInfo(status) {
        if (status.version) {
            const versionEl = document.getElementById('firmware-version');
            if (versionEl) versionEl.textContent = status.version;
        }
        if (status.ip) {
            const ipEl = document.getElementById('wifi-ip');
            if (ipEl) ipEl.textContent = status.ip;
        }
        if (status.ssid) {
            const ssidEl = document.getElementById('wifi-ssid');
            if (ssidEl) ssidEl.textContent = status.ssid;
        }
        if (status.rssi !== undefined) {
            const signalEl = document.getElementById('wifi-signal');
            if (signalEl) signalEl.textContent = `${status.rssi} dBm`;
        }
        if (status.freeHeap) {
            const usage = 100 - (status.freeHeap / 520000 * 100);
            const flashEl = document.getElementById('flash-usage');
            if (flashEl) flashEl.textContent = `${usage.toFixed(0)}% used`;
        }
        if (status.uptime) {
            const days = Math.floor(status.uptime / 86400);
            const hours = Math.floor((status.uptime % 86400) / 3600);
            const uptimeEl = document.getElementById('uptime');
            if (uptimeEl) uptimeEl.textContent = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
        }
    }

    // Show notification
    function showNotification(message, type = 'info') {
        console.log(`[${type}] ${message}`);
        // TODO: Implement visual notification
    }

    // Attach event handlers
    function attachEventHandlers() {
        const searchInput = document.getElementById('city-search');
        if (searchInput) {
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    window.searchCity();
                }
            });
        }
    }

    // Live CV/GATE monitor: polls /api/cv quickly and draws the last 30 s
    const MONITOR_INTERVAL_MS = 250;
    const MONITOR_SAMPLES = 120;
    const monitor = {
        cv: [[], []],
        cvTarget: [[], []],
        gate: [[], []],      // { high, trig } per sample
        lastEdges: null,
        busy: false
    };

    function pushSample(list, value) {
        list.push(value);
        if (list.length > MONITOR_SAMPLES) list.shift();
    }

    function pollMonitor() {
        if (document.hidden || monitor.busy) return;
        monitor.busy = true;
        fetch(`${config.apiEndpoint}/api/cv`)
            .then(r => r.json())
            .then(d => {
                const cv = [d.cv1 || 0, d.cv2 || 0];
                const targets = d.cvTargets || cv;
                const gates = [d.gate1 || 0, d.gate2 || 0];
                const edges = d.gateEdges || [0, 0];

                for (let i = 0; i < 2; i++) {
                    pushSample(monitor.cv[i], cv[i]);
                    pushSample(monitor.cvTarget[i], targets[i]);
                    // Triggers are ~20 ms, shorter than the poll, so count edges between polls
                    const trig = monitor.lastEdges !== null && edges[i] > monitor.lastEdges[i];
                    pushSample(monitor.gate[i], { high: gates[i] > 0.5, trig });
                }
                monitor.lastEdges = edges;
                currentData.cvValues = cv;
                currentData.gateValues = gates;
                if (d.cvSlew) currentData.cvSlew = d.cvSlew;

                updateLiveOutputs();
                drawScopes();
            })
            .catch(() => {})
            .finally(() => { monitor.busy = false; });
    }

    // Lightweight per-poll update (updateOutputDisplays also syncs selects and logs)
    function updateLiveOutputs() {
        for (let i = 0; i < 2; i++) {
            const cvEl = document.getElementById(`cv${i + 1}-value`);
            const cvBar = document.getElementById(`cv${i + 1}-bar`);
            if (cvEl) cvEl.textContent = `${(currentData.cvValues[i] * 5).toFixed(2)}V`;
            if (cvBar) cvBar.style.width = `${currentData.cvValues[i] * 100}%`;

            const samples = monitor.gate[i];
            const last = samples[samples.length - 1];
            const active = last && (last.high || last.trig);
            const gateEl = document.getElementById(`gate${i + 1}-value`);
            const gateBar = document.getElementById(`gate${i + 1}-bar`);
            if (gateEl) {
                gateEl.textContent = last && last.trig && !last.high ? 'TRIG' : (active ? 'HIGH' : 'LOW');
                gateEl.className = `output-value ${active ? 'gate-high' : 'gate-low'}`;
            }
            if (gateBar) gateBar.style.width = active ? '100%' : '0%';

            const slewInput = document.getElementById(`cv${i + 1}-slew`);
            if (slewInput && document.activeElement !== slewInput) {
                slewInput.value = currentData.cvSlew[i];
            }
        }
    }

    function prepareCanvas(canvas) {
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
        }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return { ctx, width, height };
    }

    function drawScopes() {
        const step = (width) => width / (MONITOR_SAMPLES - 1);
        for (let i = 0; i < 2; i++) {
            const cvCanvas = document.getElementById(`cv${i + 1}-scope`);
            if (cvCanvas) {
                const { ctx, width, height } = prepareCanvas(cvCanvas);
                const dx = step(width);
                const offset = MONITOR_SAMPLES - monitor.cv[i].length;
                const y = v => height - 2 - Math.min(1, Math.max(0, v)) * (height - 4);

                ctx.setLineDash([3, 3]);
                ctx.strokeStyle = 'rgba(0,204,255,0.5)';
                ctx.beginPath();
                monitor.cvTarget[i].forEach((v, n) => {
                    const x = (offset + n) * dx;
                    n === 0 ? ctx.moveTo(x, y(v)) : ctx.lineTo(x, y(v));
                });
                ctx.stroke();

                ctx.setLineDash([]);
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                monitor.cv[i].forEach((v, n) => {
                    const x = (offset + n) * dx;
                    n === 0 ? ctx.moveTo(x, y(v)) : ctx.lineTo(x, y(v));
                });
                ctx.stroke();
            }

            const gateCanvas = document.getElementById(`gate${i + 1}-scope`);
            if (gateCanvas) {
                const { ctx, width, height } = prepareCanvas(gateCanvas);
                const dx = step(width);
                const offset = MONITOR_SAMPLES - monitor.gate[i].length;
                monitor.gate[i].forEach((s, n) => {
                    const x = (offset + n) * dx;
                    if (s.high) {
                        ctx.fillStyle = 'rgba(0,255,136,0.35)';
                        ctx.fillRect(x, 4, dx + 0.5, height - 8);
                    }
                    if (s.trig) {
                        ctx.fillStyle = '#00ff88';
                        ctx.fillRect(x, 2, 2, height - 4);
                    }
                });
            }
        }
    }

    // Start periodic updates
    function startUpdates() {
        // First fetch device status
        fetchDeviceStatus();
        // Then fetch API key status
        fetchAPIKeys().then(() => {
            // Check API key status after fetching
            updateApiKeyStatus();
        });
        // Then start regular data updates
        fetchData();
        updateInterval = setInterval(fetchData, 2000);
        setInterval(pollMonitor, MONITOR_INTERVAL_MS);
        
        // Check for updates silently on startup
        setTimeout(checkForUpdatesQuietly, 3000);
    }
    
    // Fetch device status including device ID and saved location
    function fetchDeviceStatus() {
        fetch(`${config.apiEndpoint}/api/status`)
            .then(response => response.json())
            .then(data => {
                console.log('Device status:', data);
                if (data.deviceID) {
                    config.deviceID = data.deviceID;
                    // Update device display in Network section
                    const deviceEls = document.querySelectorAll('.device-name');
                    deviceEls.forEach(el => {
                        el.textContent = `tem-${data.deviceID}.local`;
                    });
                }

                if (data.requiresUserApiKey !== undefined) {
                    currentData.requiresUserApiKey = data.requiresUserApiKey;
                    currentData.bridgeEnabled = data.bridgeEnabled || false;
                    currentData.weatherMode = data.weatherMode || (currentData.bridgeEnabled ? 'bridge' : 'openweather');

                    const configGrid = document.querySelector('.config-grid');
                    if (configGrid) {
                        configGrid.innerHTML = buildConfigSection();
                    }
                    updateAPIStatus();
                    updateApiKeyStatus();
                }
                
                // Load saved location from device
                if (data.latitude !== undefined && data.longitude !== undefined) {
                    console.log('Loading saved location:', data.latitude, data.longitude);
                    currentData.latitude = data.latitude;
                    currentData.longitude = data.longitude;
                    
                    // Update map if already initialized
                    if (map && marker) {
                        map.setView([data.latitude, data.longitude], map.getZoom());
                        marker.setLatLng([data.latitude, data.longitude]);
                    }
                    
                    // Update coordinate display
                    const coordsEl = document.getElementById('coords');
                    if (coordsEl) {
                        coordsEl.textContent = `${data.latitude.toFixed(4)}°, ${data.longitude.toFixed(4)}°`;
                    }
                }
                
                if (data.cityName) {
                    currentData.cityName = data.cityName;
                    const locationEl = document.getElementById('location');
                    if (locationEl) {
                        locationEl.textContent = data.cityName;
                    }
                }
                
                updateDeviceInfo(data);
            })
            .catch(err => console.error('Failed to fetch device status:', err));
    }
    
    // Fetch API key status
    function fetchAPIKeys() {
        return fetch(`${config.apiEndpoint}/api/keys`)
            .then(response => response.json())
            .then(data => {
                console.log('API keys fetched:', data);
                currentData.hasOpenWeatherKey = data.hasOpenWeather || false;
                currentData.hasNasaKey = data.hasNasa || false;
                if (data.requiresUserApiKey !== undefined) {
                    currentData.requiresUserApiKey = data.requiresUserApiKey;
                }
                currentData.bridgeEnabled = data.bridgeEnabled || false;
                currentData.weatherMode = data.weatherMode || (currentData.bridgeEnabled ? 'bridge' : 'openweather');
                
                // Update form if keys exist
                if (data.openWeatherKey && data.openWeatherKey.length > 0) {
                    const owInput = document.getElementById('openweather-key');
                    if (owInput && owInput.value === '') {
                        owInput.value = '••••••••••••';
                    }
                }
                if (data.nasaKey && data.nasaKey.length > 0) {
                    const nasaInput = document.getElementById('nasa-key');
                    if (nasaInput && nasaInput.value === '') {
                        nasaInput.value = '••••••••••••';
                    }
                }
                
                // Refresh the config section to show delete buttons
                // Use setTimeout to ensure DOM is ready
                setTimeout(() => {
                    const configGrid = document.querySelector('.config-grid');
                    if (configGrid) {
                        console.log('Rebuilding config section with delete buttons');
                        configGrid.innerHTML = buildConfigSection();
                    }
                }, 100);
                
                updateAPIStatus();
                updateApiKeyStatus();
            })
            .catch(err => console.error('Failed to fetch API keys:', err));
    }

    // Cleanup
    window.addEventListener('beforeunload', () => {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    });

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
