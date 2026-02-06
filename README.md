# 🏃 RunWeather - Climate-Aware Running Analytics

A comprehensive weather and climate analysis platform for runners. Integrates real-time weather data with historical climate patterns to help runners optimize training, plan races, and understand environmental impacts on performance.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-green.svg)](https://rapinoinfeliz.github.io/RunWeather/)

## ✨ Features

### 🎯 Core Training Tools
- **VDOT Estimation**: Calculate aerobic capacity based on recent race performances
- **Training Paces**: Personalized pace targets for all workout types:
  - Easy runs
  - Subthreshold intervals (3, 6, and 10-minute reps)
  - Threshold pace

### 🌡️ Weather-Aware Adjustments
- **Heat Impact Analysis**: Real-time pace adjustments based on temperature and humidity
  - Visual heat impact percentage
  - Color-coded severity indicators
- **Wind Impact Analysis**: Metabolic cost calculations for headwind/tailwind
  - Separate pace recommendations for each direction
  - Considers runner weight and suburban wind profiles

### 📊 Climate Analysis & Planning

#### 🔥 Heat Map Visualization
- **7-Day Forecast Grid**: Hourly temperature, dew point, rain, cloud coverage, and wind speed
- **Dawn/Dusk Shading**: Visual indicators for optimal running windows
- **Night Time Overlay**: Darker shading for nighttime hours
- **Color-Coded Conditions**: Instant identification of challenging conditions

#### 📅 Monthly Averages
- **Side-by-Side Display**: Temperature and rainfall shown simultaneously
- **8-Tier Gradient System**: Granular temperature visualization
  - 🔵 < 10°C (Very Cold)
  - 🩵 10-15°C (Cold but OK)
  - 🟢 15-20°C (Perfect)
  - 🟡 20-25°C (Warm)
  - 🟡 25-28°C (Getting Hot)
  - 🟠 28-32°C (Hot)
  - 🔴 32-35°C (Very Hot)
  - 🟣 > 35°C (Extreme)
- **Smooth Animations**: Stagger entrance effects for better UX
- **Rain in Centimeters**: Clear monthly precipitation totals

#### 📈 Best Run Times Analysis
- **AI-Powered Recommendations**: Finds optimal training windows across the year
- **Sortable Table**: Compare months by multiple factors
- **Visual Indicators**: Quick identification of ideal running conditions

### 🗺️ Location Management
- **Multi-Location Support**: Save and switch between training locations
- **Favorites System**: Quick access to frequently used locations
- **Search Integration**: Powered by Nominatim OpenStreetMap
- **Auto-Population**: Weather data automatically fetched for selected locations

### 📱 Progressive Web App
- **Offline Support**: Service worker caching for reliability
- **Install Prompt**: Add to home screen functionality
- **Responsive Design**: Optimized for mobile and desktop
- **Premium Dark Theme**: Sleek, modern interface

### 🔄 Data Freshness
- **Real-Time Updates**: Floating action button for manual refresh
- **Timestamp Indicators**: "Updated X minutes ago" display
- **Auto-Refresh**: Keeps data current

## 🛠️ Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **APIs**: 
  - [Open-Meteo](https://open-meteo.com/) - Weather & Climate Data
  - [Nominatim](https://nominatim.org/) - Geocoding
- **Architecture**: PWA with Service Worker
- **Storage**: LocalStorage for locations and preferences

## 📚 Methodology & Credits

- **Pace Calculator**: [James Copeland - Norwegian Singles Method](https://mybook.to/XzwWbK3)
- **Heat Calculator**: [John Davis - Running Writings](https://apps.runningwritings.com/heat-adjusted-pace/)
- **Wind Calculator**: [John Davis - Running Writings](https://apps.runningwritings.com/wind-calculator)
- **VDOT Formula**: Jack Daniels' Running Formula
- **Weather Data**: [Open-Meteo API](https://open-meteo.com/)
- **Geocoding**: [Nominatim OpenStreetMap](https://nominatim.org/)

## 🚀 Usage

1. Visit [https://rapinoinfeliz.github.io/RunWeather/](https://rapinoinfeliz.github.io/RunWeather/)
2. Enter your VDOT or recent race time
3. Select your location or search for a new one
4. View current conditions, forecasts, and climate data
5. Analyze optimal training windows and monthly patterns

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📧 Contact

Rapino Infeliz - [GitHub](https://github.com/rapinoinfeliz) | [Email](mailto:rapinoinfeliz@gmail.com)

Project Link: [https://github.com/rapinoinfeliz/RunWeather](https://github.com/rapinoinfeliz/RunWeather)

---

**⚠️ Important**: This calculator provides scientifically-based estimates. Individual responses to environmental conditions vary. Always prioritize safety and listen to your body during training.
