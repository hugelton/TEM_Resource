// The Earth Module - Rich UI JavaScript

(function() {
    'use strict';

    // Configuration from backend
    const config = window.TEM_CONFIG || {};
    const initialData = window.TEM_DATA || {};
    
    // State
    let currentData = {
        cvValues: [0, 0, 0, 0],
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
                <div class="device-id">Device: tem-${config.deviceID}</div>
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

    // Build CV output tiles
    function buildCVTiles() {
        let html = '';
        const cvParams = ['Temperature', 'Humidity', 'Pressure', 'Wind Speed'];
        
        for (let i = 0; i < 4; i++) {
            html += `
                <div class="tile cv-tile">
                    <div class="tile-title">CV ${i + 1} - ${cvParams[i]}</div>
                    <div class="tile-value" id="cv${i + 1}-value">${(currentData.cvValues[i] * 5).toFixed(2)}</div>
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
                <div class="tile-value" style="font-size: 16px;">
                    <span id="lat-value">${currentData.latitude.toFixed(4)}</span>°, 
                    <span id="lon-value">${currentData.longitude.toFixed(4)}</span>°
                </div>
                <div class="map-container" id="map">
                    <!-- Map would go here if using Leaflet -->
                    <div style="padding: 80px 20px; text-align: center; color: #666;">
                        Click to set location
                    </div>
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
                    <input type="password" id="weather-key" placeholder="Enter API key" value="${currentData.hasApiKey ? '********' : ''}">
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
        
        if (weatherKey && weatherKey !== '********') {
            fetch('/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `weather_key=${encodeURIComponent(weatherKey)}&lat=${currentData.latitude}&lon=${currentData.longitude}`
            }).then(() => {
                alert('Settings saved!');
            });
        }
    };

    // Update location
    function updateLocation(lat, lon) {
        fetch('/api/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `lat=${lat}&lon=${lon}`
        }).then(() => {
            currentData.latitude = lat;
            currentData.longitude = lon;
            updateUI();
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
                    data.cv2 || 0,
                    data.cv3 || 0,
                    data.cv4 || 0
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
        // Update CV values
        for (let i = 0; i < 4; i++) {
            const valueEl = document.getElementById(`cv${i + 1}-value`);
            const barEl = document.getElementById(`cv${i + 1}-bar`);
            
            if (valueEl) valueEl.textContent = (currentData.cvValues[i] * 5).toFixed(2);
            if (barEl) barEl.style.width = (currentData.cvValues[i] * 100) + '%';
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
            'lon-value': currentData.longitude.toFixed(4)
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