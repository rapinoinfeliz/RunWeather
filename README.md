# 🏃‍♂️ RunWeather - Advanced Running Pace Calculator

A comprehensive, weather-aware running pace calculator that helps runners optimize their training by accounting for environmental conditions. Built as a Progressive Web App (PWA) with real-time weather integration.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-green.svg)](https://rapinoinfeliz.github.io/RunWeather/)

## ✨ Features

### 📊 Core Calculations
- **VDOT Estimation**: Calculate your VDOT score based on recent time trial performances
- **Training Paces**: Generate personalized pace targets for:
  - Easy runs
  - Subthreshold intervals (3, 6, and 10-minute reps)
  - Marathon pace
  - Half marathon pace
  - 15K pace
  - Threshold pace

### 🌡️ Weather-Aware Adjustments
- **Heat Impact Analysis**: Automatically adjusts paces based on temperature and humidity (WBGT)
  - Real-time heat impact percentage calculation
  - Visual feedback for slowdown effect
  - Based on [John Davis's Hot-Weather Running Calculator](https://apps.runningwritings.com/heat-adjusted-pace/)

- **Wind Impact Analysis**: Calculates pace adjustments for headwind and tailwind conditions
  - Separate headwind/tailwind pace recommendations
  - Metabolic cost calculations using suburban wind profile
  - Runner weight consideration for accurate adjustments
  - Based on [John Davis's Wind Calculator](https://apps.runningwritings.com/wind-calculator)

### 🌍 Location-Based Weather
- **Live Weather Integration**: Fetches current conditions via [Open-Meteo API](https://open-meteo.com/)
- **Multiple Locations**: Save and switch between different training locations
- **Auto-Population**: Temperature, dew point, and wind speed automatically filled

### 🎨 Modern UI/UX
- **Interactive Impact Cards**: Click to toggle heat and wind adjustments on/off
- **Columnar Pace Display**: Clean side-by-side comparison of base vs. adjusted paces
- **Responsive Design**: Mobile-first approach with glassmorphism aesthetics
- **Dark Mode**: Easy on the eyes for all lighting conditions
- **Offline Support**: Full PWA capabilities for use anywhere

## 🚀 Quick Start

### Prerequisites
- Node.js (for development server)
- Modern web browser

### Installation

```bash
# Clone the repository
git clone https://github.com/rapinoinfeliz/RunWeather.git

# Navigate to project directory
cd RunWeather

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Production Build

```bash
npm run build
```

## 📖 Usage Guide

### 1. Set Your Baseline
1. Enter a recent time trial (distance and time)
2. The calculator automatically computes your VDOT
3. Training paces are generated instantly

### 2. Configure Weather Conditions
**Option A: Use Live Data**
- Click the location button
- Select your city
- Weather conditions auto-populate

**Option B: Manual Entry**
- Enter temperature (°C)
- Enter dew point (°C)
- Enter wind speed (km/h)

### 3. View Adjusted Paces
- **Heat Impact Card**: Click to show/hide heat-adjusted paces
- **Wind Impact Card**: Click to show/hide wind-adjusted paces (both headwind and tailwind)
- Each pace card displays:
  - Base pace (always visible)
  - Heat-adjusted pace (when toggled)
  - Headwind/Tailwind paces (when toggled)

### 4. Configure Runner Settings
- Click the gear icon (⚙️)
- Enter your weight (kg) for accurate wind calculations
- Settings are saved locally

## 🧮 The Science Behind It

### VDOT Calculation
The calculator uses Jack Daniels' VDOT formula, which estimates aerobic capacity based on race performances. VDOT is a more practical metric than VO2max for training purposes.

### Heat Adjustment
Heat impact is calculated using:
- **Wet Bulb Globe Temperature (WBGT)**: Combines temperature and humidity
- **Performance Impact Formula**: Based on empirical data from elite runners
- **Threshold-Based Scaling**: Higher intensity paces are affected more by heat

Reference: [John Davis - Running Writings](https://apps.runningwritings.com/heat-adjusted-pace/)

### Wind Adjustment
Wind calculations account for:
- **Metabolic Cost**: Energy required to overcome air resistance
- **Runner Mass**: Heavier runners are less affected by wind
- **Wind Profile**: Uses suburban terrain model (wind increases with height)
- **Bidirectional Analysis**: Separate calculations for headwind and tailwind

Reference: [John Davis - Wind Calculator](https://apps.runningwritings.com/wind-calculator)

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with CSS Variables
- **Architecture**: Modular design with separation of concerns
  - `engine.js`: Core calculation logic
  - `ui.js`: UI rendering and state management
  - `wind.js`: Wind impact calculations
  - `api.js`: Weather data fetching
- **APIs**: 
  - [Open-Meteo](https://open-meteo.com/) - Weather data
  - [Nominatim](https://nominatim.org/) - Geocoding
- **PWA**: Service Worker for offline functionality

## 📁 Project Structure

```
RunWeather/
├── index.html              # Main HTML file
├── style.css               # Global styles
├── src/
│   ├── main.js            # Application entry point
│   ├── modules/
│   │   ├── engine.js      # VDOT and pace calculations
│   │   ├── ui.js          # UI rendering logic
│   │   ├── wind.js        # Wind impact calculations
│   │   ├── api.js         # Weather API integration
│   │   └── storage.js     # LocalStorage utilities
│   └── sw.js              # Service Worker
└── README.md
```

## 🎯 Roadmap

- [ ] Altitude adjustment calculations
- [ ] Training plan generator
- [ ] Export results to PDF
- [ ] Integration with Strava/Garmin
- [ ] Historical performance tracking
- [ ] Race predictor tool

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Credits & Attribution

- **Heat Calculator**: Methodology by [John Davis - Running Writings](https://apps.runningwritings.com/heat-adjusted-pace/)
- **Wind Calculator**: Methodology by [John Davis - Running Writings](https://apps.runningwritings.com/wind-calculator)
- **VDOT Formula**: Jack Daniels' Running Formula
- **Weather Data**: [Open-Meteo API](https://open-meteo.com/)
- **Geocoding**: [Nominatim OpenStreetMap](https://nominatim.org/)

## 📧 Contact

Filipe Ronzani - [@rapinoinfeliz](https://github.com/rapinoinfeliz)

Project Link: [https://github.com/rapinoinfeliz/RunWeather](https://github.com/rapinoinfeliz/RunWeather)

---

**Note**: This calculator provides estimates based on scientific models. Individual responses to heat and wind vary. Always prioritize safety and listen to your body during training.
