/* The Earth Module - Rich UI JavaScript */

class TEMController {
    constructor() {
        this.deviceStatus = null;
        this.cvData = null;
        this.updateInterval = null;
        this.map = null;
        this.pins = [];
        
        this.init();
    }
    
    async init() {
        console.log('🌍 THE EARTH MODULE - Initializing...');
        
        // Start real-time updates
        this.startUpdates();
        
        // Initialize map if on config page
        if (document.getElementById('map')) {
            await this.initMap();
        }
        
        // Add event listeners
        this.setupEventListeners();
        
        console.log('✅ TEM Controller initialized');
    }
    
    async startUpdates() {
        // Initial update
        await this.updateData();
        
        // Start interval updates
        this.updateInterval = setInterval(async () => {
            await this.updateData();
        }, 2000);
    }
    
    async updateData() {
        try {
            // Fetch status and CV data in parallel
            const [statusResponse, cvResponse] = await Promise.all([
                fetch('/api/status'),
                fetch('/api/cv')
            ]);
            
            this.deviceStatus = await statusResponse.json();
            this.cvData = await cvResponse.json();
            
            this.updateUI();
        } catch (error) {
            console.error('Failed to update data:', error);
            this.showError('Connection to TEM lost');
        }
    }
    
    updateUI() {
        // Update device info
        const deviceIDEl = document.getElementById('deviceID');
        if (deviceIDEl && this.deviceStatus) {
            deviceIDEl.textContent = this.deviceStatus.deviceID;
        }
        
        const freeHeapEl = document.getElementById('freeHeap');
        if (freeHeapEl && this.deviceStatus) {
            freeHeapEl.textContent = `${this.deviceStatus.freeHeap.toLocaleString()} bytes`;
        }
        
        const ipEl = document.getElementById('ipAddress');
        if (ipEl && this.deviceStatus) {
            ipEl.textContent = this.deviceStatus.ip;
        }
        
        // Update CV meters
        if (this.cvData) {
            for (let i = 1; i <= 4; i++) {
                const value = this.cvData[`cv${i}`] || 0;
                const voltage = (value * 5).toFixed(2);
                const percentage = (value * 100).toFixed(1);
                
                const valueEl = document.getElementById(`cv${i}`);
                const meterEl = document.getElementById(`meter${i}`);
                
                if (valueEl) {
                    valueEl.textContent = `${voltage}V`;
                }
                
                if (meterEl) {
                    meterEl.style.width = `${percentage}%`;
                }
            }
        }
        
        // Update last update time
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = new Date().toLocaleTimeString();
        }
    }
    
    async initMap() {
        try {
            // Check if map is already initialized
            const mapEl = document.getElementById('map');
            if (!mapEl || mapEl._leaflet_id) {
                console.log('Map already initialized or element not found');
                return;
            }
            
            // Initialize Leaflet map with dark theme
            this.map = L.map('map').setView([35.6762, 139.6503], 2);
            
            // Dark tile layer
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(this.map);
            
            // Map click handler for setting single location pin
            this.map.on('click', (e) => {
                this.addPin(e.latlng.lat, e.latlng.lng);
            });
            
            // Skip pin loading for TEM (pins managed by ESP32)
            // await this.loadPins();
            
            console.log('🗺️ TEM Map initialized');
        } catch (error) {
            console.error('Failed to initialize map:', error);
        }
    }
    
    async addPin(lat, lng) {
        // Simplified pin function - no name required, single pin per device
        try {
            const response = await fetch('/api/location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `lat=${lat}&lng=${lng}`
            });
            
            if (response.ok) {
                this.showSuccess(`Location updated to ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                // Reload page to refresh weather data
                setTimeout(() => location.reload(), 1500);
            } else {
                throw new Error('Failed to update location');
            }
        } catch (error) {
            console.error('Failed to update location:', error);
            this.showError('Failed to update location');
        }
    }
    
    async loadPins() {
        // Disabled for TEM - pins are managed by ESP32 interface
        console.log('Pin loading disabled for TEM');
        return;
        
        // Original code commented out
        // try {
        //     const response = await fetch('/api/pins');
        //     this.pins = await response.json();
        //     
        //     // Clear existing markers
        //     this.map.eachLayer((layer) => {
        //         if (layer instanceof L.Marker) {
        //             this.map.removeLayer(layer);
        //         }
        //     });
        //     
        //     // Add markers for each pin
        //     this.pins.forEach(pin => {
        //         const marker = L.marker([pin.lat, pin.lon])
        //             .addTo(this.map)
        //             .bindPopup(`
        //                 <strong>${pin.name}</strong><br>
        //                 Lat: ${pin.lat.toFixed(4)}<br>
        //                 Lng: ${pin.lon.toFixed(4)}
        //             `);
        //     });
        //     
        // } catch (error) {
        //     console.error('Failed to load pins:', error);
        // }
    }
    
    setupEventListeners() {
        // Force update button
        const forceUpdateBtn = document.getElementById('forceUpdate');
        if (forceUpdateBtn) {
            forceUpdateBtn.addEventListener('click', () => {
                this.updateData();
                this.showSuccess('Data updated');
            });
        }
        
        // Test CV buttons
        for (let i = 1; i <= 4; i++) {
            const testBtn = document.getElementById(`testCV${i}`);
            if (testBtn) {
                testBtn.addEventListener('click', () => {
                    this.testCV(i);
                });
            }
        }
    }
    
    async testCV(channel) {
        try {
            const response = await fetch(`/api/test/cv${channel}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.showSuccess(`CV ${channel} test pulse sent`);
            } else {
                throw new Error('Test failed');
            }
        } catch (error) {
            console.error(`Failed to test CV ${channel}:`, error);
            this.showError(`CV ${channel} test failed`);
        }
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
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
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Auto remove
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
    
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.temController = new TEMController();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.temController) {
        window.temController.destroy();
    }
});