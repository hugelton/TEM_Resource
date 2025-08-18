# TEM External Resources

These files provide the rich UI for The Earth Module when in Station (STA) mode.

## Files

- `css/tem.css` - Main stylesheet with solar gradient backgrounds and tile-based layout
- `js/tem.js` - JavaScript for dynamic UI updates and API communication
- `index.html` - Test page for local development

## Deployment to GitHub Pages

1. Create a new GitHub repository called `TEM_Resource`
2. Upload these files maintaining the directory structure:
   ```
   /css/tem.css
   /js/tem.js
   /index.html
   ```
3. Enable GitHub Pages in repository settings
4. The resources will be available at:
   - CSS: `https://[username].github.io/TEM_Resource/css/tem.css`
   - JS: `https://[username].github.io/TEM_Resource/js/tem.js`

## Usage

The TEM firmware automatically loads these resources when:
- Device is in Station mode (connected to WiFi)
- Internet connection is available

In AP mode or when external resources fail to load, the device falls back to a simple internal interface.

## Features

- **Solar Gradient Backgrounds**: 8 different time-based gradients (15% brightness)
- **Tile-Based Layout**: 4-column responsive grid
- **Real-time Updates**: Automatic polling of device API
- **CV Visualization**: Bar graphs showing 0-5V output levels
- **Weather Data Display**: Temperature, humidity, pressure, wind, etc.
- **Location Setting**: Click-to-set coordinates (simplified)
- **API Configuration**: Secure input for API keys

## Testing Locally

Open `index.html` in a browser to test the UI with mock data.

## Customization

Edit the CSS variables in `tem.css` to adjust:
- Grid columns
- Tile spacing
- Border radius
- Transition speeds
- Color schemes