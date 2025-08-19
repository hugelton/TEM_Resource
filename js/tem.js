// The Earth Module - Fixed UI JavaScript

(function() {
    'use strict';

    // Configuration from backend
    const config = window.TEM_CONFIG || {};
    
    // Set API endpoint from baseUrl or default to current origin
    config.apiEndpoint = config.baseUrl || window.location.origin;
    
    // State
    let currentData = {
        cvValues: [0, 0, 0, 0],
        temperature: '-',
        humidity: '-',
        pressure: '-',
        windSpeed: '-',
        visibility: '-',
        cloudCover: '-',
        dewPoint: '-',
        moonPhase: 0.5,
        solarElevation: '-',
        auroraActivity: '-',
        solarWind: '-',
        latitude: 35.6762,
        longitude: 139.6503,
        hasOpenWeatherKey: false,
        hasNasaKey: false,
        connectionStatus: 'offline'
    };

    let map = null;
    let updateInterval = null;

    // Initialize
    function init() {
        console.log('TEM UI Initializing...');
        
        // Build UI
        buildInterface();
        
        // Start data updates
        startUpdates();
        
        // Mark as initialized
        window.TEMInitialized = true;
        
        // Hide loading, show app
        document.getElementById('loading').style.display = 'none';
        document.getElementById('app').style.display = 'block';
    }

    // Build the interface
    function buildInterface() {
        const app = document.getElementById('app');
        
        app.innerHTML = `
            <div class="header">
                <h1>The Earth Module</h1>
                <div class="device-id">
                    Device: tem-${config.deviceID}
                    <span class="connection-indicator" id="connection-indicator"></span>
                    <span class="api-status-indicator">
                        API: <span id="api-status" class="status ${currentData.hasOpenWeatherKey ? 'online' : 'offline'}">
                            ${currentData.hasOpenWeatherKey ? '●' : '○'}
                        </span>
                    </span>
                </div>
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
                    ${buildWiFiSection()}
                </div>
            </div>
        `;
        
        // Initialize map
        initMap();
        
        // Attach event handlers
        attachEventHandlers();
    }

    // Build CV output tiles
    function buildCVTiles() {
        let html = '';
        const cvParams = ['Temperature', 'Humidity', 'Pressure', 'Wind Speed'];
        
        for (let i = 0; i < 4; i++) {
            const voltage = currentData.cvValues[i] === 0 ? '-' : (currentData.cvValues[i] * 5).toFixed(2);
            html += `
                <div class="tile cv-tile">
                    <div class="tile-title">CV ${i + 1} - ${cvParams[i]}</div>
                    <div class="tile-value" id="cv${i + 1}-value">${voltage}</div>
                    <div class="tile-unit">Volts</div>
                    <div class="cv-bar">
                        <div class="cv-fill" id="cv${i + 1}-bar" style="width: ${currentData.cvValues[i] * 100}%"></div>
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
            let displayValue;
            
            if (value === '-' || value === undefined || value === null) {
                displayValue = '-';
            } else if (param.transform) {
                displayValue = param.transform(value);
            } else {
                displayValue = value.toFixed(param.decimals);
            }
            
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
                <div class="tile-value" style="font-size: 16px;">
                    <span id="lat-value">${currentData.latitude.toFixed(4)}</span>°, 
                    <span id="lon-value">${currentData.longitude.toFixed(4)}</span>°
                </div>
                <div class="map-container" id="map"></div>
            </div>
        `;
    }

    // Build settings tile
    function buildSettingsTile() {
        return `
            <div class="tile settings-tile">
                <div class="tile-title">
                    API Configuration
                    <span class="status ${currentData.hasOpenWeatherKey ? 'online' : 'offline'}" id="api-status"></span>
                </div>
                <div class="input-group">
                    <label>OpenWeather API Key</label>
                    <div class="api-key-input">
                        <input type="password" id="weather-key" placeholder="Enter API key" value="${currentData.hasOpenWeatherKey ? '••••••••••••••••' : ''}">
                        <button class="delete-btn" id="delete-weather-key" onclick="deleteApiKey('openweather')" style="display: ${currentData.hasOpenWeatherKey ? 'block' : 'none'}">×</button>
                    </div>
                </div>
                <div class="input-group">
                    <label>NASA API Key (Optional)</label>
                    <div class="api-key-input">
                        <input type="password" id="nasa-key" placeholder="Enter NASA API key" value="${currentData.hasNasaKey ? '••••••••••••••••' : ''}">
                        <button class="delete-btn" id="delete-nasa-key" onclick="deleteApiKey('nasa')" style="display: ${currentData.hasNasaKey ? 'block' : 'none'}">×</button>
                    </div>
                </div>
                <button class="btn" onclick="saveSettings()">Save API Keys</button>
            </div>
        `;
    }

    // Build WiFi section (separate from API settings)
    function buildWiFiSection() {
        return `
            <div class="tile wifi-section">
                <div class="tile-title">Network Settings</div>
                <div class="tile-value" style="font-size: 16px;">WiFi Configuration</div>
                <button class="btn btn-secondary" onclick="resetWiFi()">Reset WiFi Settings</button>
            </div>
        `;
    }

    // Get moon phase icon
    function getMoonPhaseIcon(phase) {
        if (phase === '-' || phase === undefined || phase === null) return '-';
        const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
        const index = Math.round(phase * 7);
        return icons[index] || '🌕';
    }

    // Initialize map
    function initMap() {
        try {
            if (typeof L === 'undefined') {
                console.log('Leaflet not available, showing placeholder');
                return;
            }

            map = L.map('map').setView([currentData.latitude, currentData.longitude], 2);
            
            // Dark tile layer
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(map);
            
            // Add current location marker
            const marker = L.marker([currentData.latitude, currentData.longitude]).addTo(map);
            
            // Map click handler
            map.on('click', function(e) {
                updateLocation(e.latlng.lat, e.latlng.lng);
            });
            
            console.log('Map initialized successfully');
        } catch (error) {
            console.error('Failed to initialize map:', error);
            const mapEl = document.getElementById('map');
            if (mapEl) {
                mapEl.innerHTML = '<div style="padding: 80px 20px; text-align: center; color: #666;">Click to set location<br><small>Map unavailable</small></div>';
            }
        }
    }

    // Attach event handlers
    function attachEventHandlers() {
        // No additional handlers needed as functions are attached via onclick
    }

    // Save settings
    window.saveSettings = function() {
        const weatherKey = document.getElementById('weather-key').value;
        const nasaKey = document.getElementById('nasa-key').value;
        
        const data = new URLSearchParams();
        
        if (weatherKey && weatherKey !== '••••••••••••••••') {
            data.append('openweather', weatherKey);
        }
        if (nasaKey && nasaKey !== '••••••••••••••••') {
            data.append('nasa', nasaKey);
        }
        
        fetch(`${config.apiEndpoint}/api/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data
        }).then(response => {
            if (response.ok) {
                showNotification('API keys saved successfully!', 'success');
                // Refresh data
                fetchData();
            } else {
                showNotification('Failed to save API keys', 'error');
            }
        }).catch(error => {
            console.error('Error saving API keys:', error);
            showNotification('Failed to save API keys', 'error');
        });
    };

    // Delete API key
    window.deleteApiKey = function(keyType) {
        if (!confirm(`Delete ${keyType} API key?`)) return;
        
        const data = new URLSearchParams();
        data.append(keyType, 'DELETE');
        
        fetch(`${config.apiEndpoint}/api/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data
        }).then(response => {
            if (response.ok) {
                showNotification(`${keyType} API key deleted`, 'success');
                // Refresh UI
                buildInterface();
                fetchData();
            } else {
                showNotification('Failed to delete API key', 'error');
            }
        }).catch(error => {
            console.error('Error deleting API key:', error);
            showNotification('Failed to delete API key', 'error');
        });
    };

    // Reset WiFi
    window.resetWiFi = function() {
        if (!confirm('Reset WiFi settings? The device will restart in AP mode.')) return;
        
        fetch(`${config.apiEndpoint}/wifi-setup`, {
            method: 'GET'
        }).then(() => {
            showNotification('WiFi settings reset. Device restarting...', 'success');
        }).catch(error => {
            console.error('Error resetting WiFi:', error);
            showNotification('Failed to reset WiFi', 'error');
        });
    };

    // Update location
    function updateLocation(lat, lon) {
        fetch(`${config.apiEndpoint}/api/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `lat=${lat}&lng=${lon}`
        }).then(response => {
            if (response.ok) {
                currentData.latitude = lat;
                currentData.longitude = lon;
                updateUI();
                showNotification('Location updated', 'success');
            } else {
                showNotification('Failed to update location', 'error');
            }
        }).catch(error => {
            console.error('Error updating location:', error);
            showNotification('Failed to update location', 'error');
        });
    }

    // Start periodic updates
    function startUpdates() {
        // Initial update
        fetchData();
        
        // Periodic updates
        updateInterval = setInterval(fetchData, config.updateInterval || 2000);
    }

    // Fetch data from device
    function fetchData() {
        const connectionIndicator = document.getElementById('connection-indicator');
        const apiStatus = document.getElementById('api-status');
        
        // Update connection indicator
        if (connectionIndicator) {
            connectionIndicator.className = 'connection-indicator updating';
        }
        
        Promise.all([
            fetch(`${config.apiEndpoint}/api/cv`).then(r => r.json()).catch(() => null),
            fetch(`${config.apiEndpoint}/api/weather`).then(r => r.json()).catch(() => null),
            fetch(`${config.apiEndpoint}/api/status`).then(r => r.json()).catch(() => null),
            fetch(`${config.apiEndpoint}/api/keys`).then(r => r.json()).catch(() => null)
        ]).then(([cvData, weatherData, statusData, keysData]) => {
            // Update connection status
            currentData.connectionStatus = 'connected';
            if (connectionIndicator) {
                connectionIndicator.className = 'connection-indicator connected';
            }
            
            // Update CV values
            if (cvData) {
                currentData.cvValues = [
                    cvData.cv1 || 0,
                    cvData.cv2 || 0,
                    cvData.cv3 || 0,
                    cvData.cv4 || 0
                ];
            }
            
            // Update weather data
            if (weatherData) {
                // Check if we have real weather data or placeholder values
                const hasRealData = weatherData.temperature !== 20.0 || weatherData.humidity !== 60.0;
                
                if (hasRealData) {
                    currentData.temperature = weatherData.temperature || '-';
                    currentData.humidity = weatherData.humidity || '-';
                    currentData.pressure = weatherData.pressure || '-';
                    currentData.windSpeed = weatherData.windSpeed || '-';
                    currentData.visibility = weatherData.visibility || '-';
                    currentData.cloudCover = weatherData.cloudCover || '-';
                    currentData.dewPoint = weatherData.dewPoint || '-';
                    currentData.hasOpenWeatherKey = true;
                } else {
                    // No real data, show placeholders
                    currentData.temperature = '-';
                    currentData.humidity = '-';
                    currentData.pressure = '-';
                    currentData.windSpeed = '-';
                    currentData.visibility = '-';
                    currentData.cloudCover = '-';
                    currentData.dewPoint = '-';
                    currentData.hasOpenWeatherKey = false;
                }
                
                currentData.latitude = weatherData.lat || currentData.latitude;
                currentData.longitude = weatherData.lng || currentData.longitude;
            }
            
            // Update device info
            if (statusData) {
                config.deviceID = statusData.deviceID || 'unknown';
            }
            
            // Update API keys status
            if (keysData) {
                currentData.hasOpenWeatherKey = keysData.hasOpenWeather;
                currentData.hasNasaKey = keysData.hasNasa;
                currentData.openWeatherKey = keysData.openWeatherKey;
                currentData.nasaKey = keysData.nasaKey;
                
                // Update API key inputs if they exist
                const openWeatherInput = document.getElementById('openweather-key');
                const nasaInput = document.getElementById('nasa-key');
                const deleteOpenWeatherBtn = document.getElementById('delete-openweather-key');
                const deleteNasaBtn = document.getElementById('delete-nasa-key');
                
                if (openWeatherInput && !openWeatherInput.value && keysData.openWeatherKey) {
                    openWeatherInput.placeholder = keysData.openWeatherKey || 'Enter OpenWeather API key';
                }
                if (nasaInput && !nasaInput.value && keysData.nasaKey) {
                    nasaInput.placeholder = keysData.nasaKey || 'Enter NASA API key';
                }
                
                // Show/hide delete buttons
                if (deleteOpenWeatherBtn) {
                    deleteOpenWeatherBtn.style.display = keysData.hasOpenWeather ? 'block' : 'none';
                }
                if (deleteNasaBtn) {
                    deleteNasaBtn.style.display = keysData.hasNasa ? 'block' : 'none';
                }
            }
            
            // Update API status indicator
            if (apiStatus) {
                apiStatus.className = `status ${currentData.hasOpenWeatherKey ? 'online' : 'offline'}`;
            }
            
            updateUI();
        }).catch(error => {
            console.error('Failed to fetch data:', error);
            currentData.connectionStatus = 'offline';
            if (connectionIndicator) {
                connectionIndicator.className = 'connection-indicator offline';
            }
        });
    }

    // Update UI with current data
    function updateUI() {
        // Update CV values
        for (let i = 0; i < 4; i++) {
            const valueEl = document.getElementById(`cv${i + 1}-value`);
            const barEl = document.getElementById(`cv${i + 1}-bar`);
            
            if (valueEl) {
                const voltage = currentData.cvValues[i] === 0 ? '-' : (currentData.cvValues[i] * 5).toFixed(2);
                valueEl.textContent = voltage;
            }
            if (barEl) {
                barEl.style.width = (currentData.cvValues[i] * 100) + '%';
            }
        }
        
        // Update weather values
        const updates = {
            'temperature-value': currentData.temperature === '-' ? '-' : currentData.temperature.toFixed(1),
            'humidity-value': currentData.humidity === '-' ? '-' : currentData.humidity.toFixed(0),
            'pressure-value': currentData.pressure === '-' ? '-' : currentData.pressure.toFixed(0),
            'windSpeed-value': currentData.windSpeed === '-' ? '-' : currentData.windSpeed.toFixed(1),
            'visibility-value': currentData.visibility === '-' ? '-' : currentData.visibility.toFixed(1),
            'cloudCover-value': currentData.cloudCover === '-' ? '-' : currentData.cloudCover.toFixed(0),
            'dewPoint-value': currentData.dewPoint === '-' ? '-' : currentData.dewPoint.toFixed(1),
            'moonPhase-value': getMoonPhaseIcon(currentData.moonPhase),
            'lat-value': currentData.latitude.toFixed(4),
            'lon-value': currentData.longitude.toFixed(4)
        };
        
        for (const [id, value] of Object.entries(updates)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }
        
        // Update device ID in header
        const deviceIdEl = document.querySelector('.device-id');
        if (deviceIdEl) {
            deviceIdEl.innerHTML = `Device: tem-${config.deviceID} <span class="connection-indicator ${currentData.connectionStatus === 'connected' ? 'connected' : 'offline'}" id="connection-indicator"></span>`;
        }
    }

    // Show notification
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            background: ${type === 'success' ? '#00ff88' : type === 'error' ? '#ff4444' : '#2196F3'};
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
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