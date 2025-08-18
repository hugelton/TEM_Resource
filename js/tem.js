// The Earth Module - Rich UI JavaScript

(function() {
    'use strict';

    // Configuration from backend
    const config = window.TEM_CONFIG || {};
    const initialData = window.TEM_DATA || {};
    
    // State
    let currentData = {
        cvValues: [0, 0],
        gateValues: [0, 0],
        temperature: 20,
        humidity: 50,
        pressure: 1013,
        windSpeed: 0,
        visibility: 10,
        cloudCover: 0,
        dewPoint: 15,
        moonPhase: 0.5,
        solarElevation: 45,
        auroraActivity: 0,
        solarWind: 400,
        latitude: 35.6762,
        longitude: 139.6503,
        ...initialData
    };

    // Initialize
    function init() {
        console.log('TEM UI Initializing...');
        
        // Set time-based background
        updateBackground();
        
        // Build UI
        buildInterface();
        
        // Start data updates
        startUpdates();
        
        // Initialize map
        initMap();
        
        // Mark as initialized
        window.TEMInitialized = true;
        
        // Hide loading, show app
        document.getElementById('loading').style.display = 'none';
        document.getElementById('app').style.display = 'block';
    }

    // Update background based on time
    function updateBackground() {
        const hour = new Date().getHours();
        let timeClass = 'time-night';
        
        if (hour >= 0 && hour < 4) timeClass = 'time-midnight';
        else if (hour >= 4 && hour < 6) timeClass = 'time-dawn';
        else if (hour >= 6 && hour < 8) timeClass = 'time-sunrise';
        else if (hour >= 8 && hour < 12) timeClass = 'time-morning';
        else if (hour >= 12 && hour < 16) timeClass = 'time-noon';
        else if (hour >= 16 && hour < 18) timeClass = 'time-afternoon';
        else if (hour >= 18 && hour < 20) timeClass = 'time-sunset';
        else timeClass = 'time-night';
        
        document.body.className = timeClass;
    }

    // Build the interface
    function buildInterface() {
        const app = document.getElementById('app');
        
        app.innerHTML = `
            <div class="header">
                <h1>The Earth Module</h1>
                <div class="device-id">Device: tem-${config.deviceID || 'unknown'}</div>
            </div>
            
            <div class="container">
                <!-- CV Outputs -->
                <div class="grid" id="cv-grid">
                    ${buildCVTiles()}
                </div>
                
                <!-- Weather Data -->
                <div class="grid" id="weather-grid">
                    ${buildWeatherTiles()}
                </div>
                
                <!-- Location & Settings -->
                <div class="grid" id="settings-grid">
                    ${buildLocationTile()}
                    ${buildSettingsTile()}
                </div>
            </div>
        `;
        
        // Attach event handlers
        attachEventHandlers();
    }

    // Build CV and GATE output tiles
    function buildCVTiles() {
        let html = '';
        const cvParams = currentData.cvParams || [0, 1];
        const gateParams = currentData.gateParams || [2, 3];
        const paramNames = ['Temperature', 'Humidity', 'Pressure', 'Wind Speed', 'Visibility', 'Cloud Cover', 'Dew Point', 'Moon Phase', 'Solar Elevation', 'Aurora Activity', 'Solar Wind', 'UV Index'];
        
        // CV outputs (2)
        for (let i = 0; i < 2; i++) {
            const paramName = paramNames[cvParams[i]] || 'Unknown';
            html += `
                <div class="tile cv-tile">
                    <div class="tile-title">CV ${i + 1} - ${paramName}</div>
                    <div class="tile-value" id="cv${i + 1}-value">${(currentData.cvValues[i] * 5).toFixed(2)}</div>
                    <div class="tile-unit">Volts</div>
                    <div class="cv-bar">
                        <div class="cv-fill" id="cv${i + 1}-bar" style="width: ${currentData.cvValues[i] * 100}%"></div>
                    </div>
                </div>
            `;
        }
        
        // GATE outputs (2)
        for (let i = 0; i < 2; i++) {
            const paramName = paramNames[gateParams[i]] || 'Unknown';
            html += `
                <div class="tile gate-tile">
                    <div class="tile-title">GATE ${i + 1} - ${paramName}</div>
                    <div class="tile-value" id="gate${i + 1}-value">${currentData.gateValues[i] ? 'HIGH' : 'LOW'}</div>
                    <div class="tile-unit">5V</div>
                    <div class="cv-bar">
                        <div class="cv-fill gate-fill" id="gate${i + 1}-bar" style="width: ${currentData.gateValues[i] ? '100' : '0'}%; background: ${currentData.gateValues[i] ? '#4CAF50' : '#333'}"></div>
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    // Build weather data tiles
    function buildWeatherTiles() {
        const weatherParams = [
            { key: 'temperature', label: 'Temperature', unit: '°C', decimals: 1 },
            { key: 'humidity', label: 'Humidity', unit: '%', decimals: 0 },
            { key: 'pressure', label: 'Pressure', unit: 'hPa', decimals: 0 },
            { key: 'windSpeed', label: 'Wind Speed', unit: 'm/s', decimals: 1 },
            { key: 'visibility', label: 'Visibility', unit: 'km', decimals: 1 },
            { key: 'cloudCover', label: 'Cloud Cover', unit: '%', decimals: 0 },
            { key: 'dewPoint', label: 'Dew Point', unit: '°C', decimals: 1 },
            { key: 'moonPhase', label: 'Moon Phase', unit: '', decimals: 2, transform: v => getMoonPhaseIcon(v) }
        ];
        
        let html = '';
        weatherParams.forEach(param => {
            const value = currentData[param.key];
            const displayValue = param.transform ? param.transform(value) : value.toFixed(param.decimals);
            
            html += `
                <div class="tile">
                    <div class="tile-title">${param.label}</div>
                    <div class="tile-value" id="${param.key}-value">${displayValue}</div>
                    <div class="tile-unit">${param.unit}</div>
                </div>
            `;
        });
        
        return html;
    }

    // Build location tile
    function buildLocationTile() {
        return `
            <div class="tile location-tile">
                <div class="tile-title">Location</div>
                <div class="tile-value" style="font-size: 18px; margin-bottom: 5px;">
                    <span id="city-name">${currentData.cityName || currentData.city || 'Unknown'}</span>
                </div>
                <div class="tile-value" style="font-size: 14px; opacity: 0.8;">
                    <span id="lat-value">${currentData.latitude.toFixed(4)}</span>°, 
                    <span id="lon-value">${currentData.longitude.toFixed(4)}</span>°
                </div>
                <div style="display: flex; gap: 5px; margin: 10px 0;">
                    <button class="btn btn-primary" onclick="getCurrentLocation()" style="flex: 1;">
                        📍 Current Location
                    </button>
                    <button class="btn btn-secondary" onclick="showLocationSearch()" style="flex: 1;">
                        🔍 Search
                    </button>
                </div>
                <div id="location-search" style="display: none; margin: 10px 0;">
                    <input type="text" id="location-query" placeholder="City name or address" 
                           onkeypress="if(event.key==='Enter') searchLocation()"
                           style="width: 100%; padding: 8px; background: #222; border: 1px solid #444; color: #fff; border-radius: 4px;">
                    <button class="btn btn-primary" onclick="searchLocation()" style="width: 100%; margin-top: 5px;">Search</button>
                </div>
                <div id="location-status" style="margin: 5px 0; font-size: 12px; color: #888;"></div>
                <div class="map-container" id="map-container">
                    <div id="map" style="height: 200px; background: #1a1a1a; border-radius: 8px;"></div>
                </div>
            </div>
        `;
    }

    // Build settings tile
    function buildSettingsTile() {
        return `
            <div class="tile settings-tile">
                <div class="tile-title">API Configuration</div>
                <div class="input-group">
                    <label>OpenWeather API Key</label>
                    <div style="display: flex; gap: 5px;">
                        <input type="password" id="weather-key" placeholder="-" value="${currentData.apiKeys?.openweather ? '********' : ''}" style="flex: 1;">
                        ${currentData.apiKeys?.openweather ? '<button class="btn btn-danger" onclick="deleteApiKey(\'openweather\')">Delete</button>' : ''}
                    </div>
                </div>
                <div class="input-group">
                    <label>NASA API Key</label>
                    <div style="display: flex; gap: 5px;">
                        <input type="password" id="nasa-key" placeholder="-" value="${currentData.apiKeys?.nasa ? '********' : ''}" style="flex: 1;">
                        ${currentData.apiKeys?.nasa ? '<button class="btn btn-danger" onclick="deleteApiKey(\'nasa\')">Delete</button>' : ''}
                    </div>
                </div>
                <button class="btn" onclick="saveSettings()">Save Settings</button>
                <button class="btn btn-secondary" onclick="location.href='/reset'" style="margin-left: 10px;">Reset WiFi</button>
            </div>
        `;
    }

    // Get moon phase icon
    function getMoonPhaseIcon(phase) {
        const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
        const index = Math.round(phase * 7);
        return icons[index] || '🌕';
    }

    // Attach event handlers
    function attachEventHandlers() {
        // Map click handler (simplified)
        const mapEl = document.getElementById('map');
        if (mapEl) {
            mapEl.addEventListener('click', function(e) {
                // In a real implementation, this would use a proper map library
                const rect = this.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                
                // Convert to lat/lon (very simplified)
                const lat = 90 - (y * 180);
                const lon = (x * 360) - 180;
                
                updateLocation(lat, lon);
            });
        }
    }

    // Save settings
    window.saveSettings = function() {
        const weatherKey = document.getElementById('weather-key').value;
        const nasaKey = document.getElementById('nasa-key').value;
        
        const params = new URLSearchParams();
        
        // Only add keys if they're not masked values
        if (weatherKey && weatherKey !== '********' && weatherKey !== '') {
            params.append('openweather', weatherKey);
        }
        if (nasaKey && nasaKey !== '********' && nasaKey !== '') {
            params.append('nasa', nasaKey);
        }
        
        if (params.toString()) {
            fetch('/api/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            }).then(response => {
                if (response.ok) {
                    alert('Settings saved!');
                    // Refresh data to get updated weather
                    fetchData();
                } else {
                    alert('Failed to save settings');
                }
            }).catch(err => {
                console.error('Save settings error:', err);
                alert('Error saving settings');
            });
        } else {
            alert('No changes to save');
        }
    };

    // Update location
    function updateLocation(lat, lon, showSuccess = false) {
        fetch('/api/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `lat=${lat}&lng=${lon}`  // Fixed: lng instead of lon
        }).then(() => {
            currentData.latitude = lat;
            currentData.longitude = lon;
            updateUI();
            if (showSuccess) {
                updateLocationStatus('Location updated successfully', 'success');
            }
        }).catch(err => {
            console.error('Location update error:', err);
            updateLocationStatus('Failed to update location', 'error');
        });
    }
    
    // Get current location using browser Geolocation API
    window.getCurrentLocation = function() {
        const statusEl = document.getElementById('location-status');
        
        if (!navigator.geolocation) {
            updateLocationStatus('Geolocation not supported by your browser', 'error');
            return;
        }
        
        updateLocationStatus('Getting your location...', 'info');
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                updateLocation(lat, lon, true);
                
                // Update map if available
                if (window.temMap && window.temMarker) {
                    window.temMarker.setLatLng([lat, lon]);
                    window.temMap.setView([lat, lon], 12);
                    window.temMarker.setPopupContent(`<b>Your Location</b><br>${lat.toFixed(4)}, ${lon.toFixed(4)}`).openPopup();
                }
                
                updateLocationStatus(`📍 Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'success');
            },
            (error) => {
                let message = 'Unable to get location';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location permission denied';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location information unavailable';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out';
                        break;
                }
                updateLocationStatus(message, 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };
    
    // Show/hide location search
    window.showLocationSearch = function() {
        const searchDiv = document.getElementById('location-search');
        if (searchDiv) {
            searchDiv.style.display = searchDiv.style.display === 'none' ? 'block' : 'none';
            if (searchDiv.style.display === 'block') {
                document.getElementById('location-query').focus();
            }
        }
    };
    
    // Search location using Nominatim (OpenStreetMap)
    window.searchLocation = function() {
        const query = document.getElementById('location-query').value;
        if (!query) return;
        
        updateLocationStatus('Searching...', 'info');
        
        // Use Nominatim API (free, no key required)
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const result = data[0];
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);
                    const displayName = result.display_name;
                    
                    updateLocation(lat, lon, true);
                    
                    // Update map
                    if (window.temMap && window.temMarker) {
                        window.temMarker.setLatLng([lat, lon]);
                        window.temMap.setView([lat, lon], 12);
                        window.temMarker.setPopupContent(`<b>${displayName}</b><br>${lat.toFixed(4)}, ${lon.toFixed(4)}`).openPopup();
                    }
                    
                    updateLocationStatus(`Found: ${displayName.split(',')[0]}`, 'success');
                    
                    // Hide search box
                    document.getElementById('location-search').style.display = 'none';
                    document.getElementById('location-query').value = '';
                } else {
                    updateLocationStatus('Location not found', 'error');
                }
            })
            .catch(err => {
                console.error('Search error:', err);
                updateLocationStatus('Search failed', 'error');
            });
    };
    
    // Update location status message
    function updateLocationStatus(message, type) {
        const statusEl = document.getElementById('location-status');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = type === 'error' ? '#f44' : type === 'success' ? '#4f4' : '#888';
            
            // Auto-hide success messages after 3 seconds
            if (type === 'success') {
                setTimeout(() => {
                    if (statusEl.textContent === message) {
                        statusEl.textContent = '';
                    }
                }, 3000);
            }
        }
    }
    
    // Delete API key
    window.deleteApiKey = function(keyType) {
        if (confirm(`Delete ${keyType} API key?`)) {
            const params = new URLSearchParams();
            params.append(keyType, 'DELETE');
            
            fetch('/api/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            }).then(response => {
                if (response.ok) {
                    alert('API key deleted');
                    currentData.apiKeys[keyType] = false;
                    buildInterface(); // Rebuild UI to update buttons
                    fetchData();
                }
            });
        }
    };
    
    // Initialize map
    function initMap() {
        const mapEl = document.getElementById('map');
        if (!mapEl) {
            console.error('Map element not found');
            return;
        }
        
        console.log('Initializing map, Leaflet available:', typeof L !== 'undefined');
        
        // Check if Leaflet is available
        if (typeof L !== 'undefined') {
            try {
                // Initialize Leaflet map
                const map = L.map('map', {
                    center: [currentData.latitude || 35.6762, currentData.longitude || 139.6503],
                    zoom: 10,
                    zoomControl: true,
                    attributionControl: false
                });
                
                // Dark theme tiles
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '© OpenStreetMap contributors © CARTO',
                    subdomains: 'abcd',
                    maxZoom: 19
                }).addTo(map);
                
                // Add marker
                const marker = L.marker([currentData.latitude || 35.6762, currentData.longitude || 139.6503], {
                    draggable: true
                }).addTo(map);
                
                // Popup with city name
                marker.bindPopup(`<b>${currentData.cityName || currentData.city || 'Current Location'}</b><br>${(currentData.latitude || 35.6762).toFixed(4)}, ${(currentData.longitude || 139.6503).toFixed(4)}`).openPopup();
                
                // Map click handler
                map.on('click', function(e) {
                    marker.setLatLng([e.latlng.lat, e.latlng.lng]);
                    marker.setPopupContent(`<b>New Location</b><br>${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`).openPopup();
                    updateLocation(e.latlng.lat, e.latlng.lng);
                });
                
                // Marker drag handler
                marker.on('dragend', function(e) {
                    const pos = marker.getLatLng();
                    marker.setPopupContent(`<b>New Location</b><br>${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`).openPopup();
                    updateLocation(pos.lat, pos.lng);
                });
                
                // Store references
                window.temMap = map;
                window.temMarker = marker;
                
                console.log('Leaflet map initialized successfully');
            } catch (err) {
                console.error('Leaflet error:', err);
                initFallbackMap(mapEl);
            }
        } else {
            console.log('Leaflet not available, using fallback');
            initFallbackMap(mapEl);
        }
    }
    
    // Fallback map
    function initFallbackMap(mapEl) {
        mapEl.innerHTML = `
            <div style="height: 200px; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); 
                 border-radius: 8px; display: flex; align-items: center; justify-content: center; 
                 cursor: crosshair; position: relative;">
                <div style="text-align: center; color: #888;">
                    <div style="font-size: 16px; margin-bottom: 10px;">📍 ${currentData.cityName || currentData.city || 'Set Location'}</div>
                    <div style="font-size: 13px; opacity: 0.7;">${(currentData.latitude || 0).toFixed(3)}°, ${(currentData.longitude || 0).toFixed(3)}°</div>
                    <div style="font-size: 11px; margin-top: 15px; opacity: 0.5;">Click to set location</div>
                </div>
            </div>
        `;
        
        mapEl.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            const lat = 90 - (y * 180);
            const lon = (x * 360) - 180;
            
            updateLocation(lat, lon);
        });
    }

    // Start periodic updates
    function startUpdates() {
        // Initial update
        fetchData();
        
        // Periodic updates
        setInterval(fetchData, config.updateInterval || 1000);
        
        // Update background every minute
        setInterval(updateBackground, 60000);
    }

    // Fetch data from device
    function fetchData() {
        // Fetch CV values
        fetch('/api/cv')
            .then(r => r.json())
            .then(data => {
                currentData.cvValues = [
                    data.cv1 || 0,
                    data.cv2 || 0
                ];
                currentData.gateValues = [
                    data.gate1 || 0,
                    data.gate2 || 0
                ];
                updateUI();
            })
            .catch(console.error);
        
        // Fetch weather data
        fetch('/api/weather')
            .then(r => r.json())
            .then(data => {
                Object.assign(currentData, data);
                updateUI();
            })
            .catch(console.error);
    }

    // Update UI with current data
    function updateUI() {
        // Update CV values (only 2 CV outputs)
        for (let i = 0; i < 2; i++) {
            const valueEl = document.getElementById(`cv${i + 1}-value`);
            const barEl = document.getElementById(`cv${i + 1}-bar`);
            
            if (valueEl) valueEl.textContent = (currentData.cvValues[i] * 5).toFixed(2);
            if (barEl) barEl.style.width = (currentData.cvValues[i] * 100) + '%';
        }
        
        // Update GATE values (2 GATE outputs)
        for (let i = 0; i < 2; i++) {
            const valueEl = document.getElementById(`gate${i + 1}-value`);
            const barEl = document.getElementById(`gate${i + 1}-bar`);
            
            if (valueEl) valueEl.textContent = currentData.gateValues[i] ? 'HIGH' : 'LOW';
            if (barEl) barEl.style.width = currentData.gateValues[i] ? '100%' : '0%';
        }
        
        // Update weather values
        const updates = {
            'temperature-value': currentData.temperature.toFixed(1),
            'humidity-value': currentData.humidity.toFixed(0),
            'pressure-value': currentData.pressure.toFixed(0),
            'windSpeed-value': currentData.windSpeed.toFixed(1),
            'visibility-value': currentData.visibility.toFixed(1),
            'cloudCover-value': currentData.cloudCover.toFixed(0),
            'dewPoint-value': currentData.dewPoint.toFixed(1),
            'moonPhase-value': getMoonPhaseIcon(currentData.moonPhase),
            'lat-value': currentData.latitude.toFixed(4),
            'lon-value': currentData.longitude.toFixed(4),
            'city-name': currentData.cityName || currentData.city || 'Unknown'
        };
        
        for (const [id, value] of Object.entries(updates)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();