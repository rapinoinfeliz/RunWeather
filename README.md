#  RunWeather - Weather Adjusted Running Pace Calculator

A comprehensive, weather-aware running pace calculator that helps runners optimize their training by accounting for environmental conditions. Built as a Progressive Web App (PWA) with real-time weather integration.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-green.svg)](https://rapinoinfeliz.github.io/RunWeather/)

##  Features

###  Core Calculations
- **VDOT Estimation**: Calculate your VDOT score based on recent time trial performances
- **Training Paces**: Generate personalized pace targets for:
  - Easy runs
  - Subthreshold intervals (3, 6, and 10-minute reps)
  - Threshold pace

###  Weather-Aware Adjustments
- **Heat Impact Analysis**: Automatically adjusts paces based on temperature and humidity 
  - Real-time heat impact percentage calculation
  - Visual feedback for slowdown effect
  - Based on [John Davis's Hot-Weather Running Calculator](https://apps.runningwritings.com/heat-adjusted-pace/)

- **Wind Impact Analysis**: Calculates pace adjustments for headwind and tailwind conditions
  - Separate headwind/tailwind pace recommendations
  - Metabolic cost calculations using suburban wind profile
  - Runner weight consideration for accurate adjustments
  - Based on [John Davis's Wind Calculator](https://apps.runningwritings.com/wind-calculator)

###  Location-Based Weather
- **Live Weather Integration**: Fetches current conditions via [Open-Meteo API](https://open-meteo.com/)
- **Multiple Locations**: Save and switch between different training locations
- **Auto-Population**: Temperature, dew point, and wind speed automatically filled


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



##  License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits & Attribution

- **Pace Calculator**: Methodology by [James Copeland - Norwegian Singles Method: Subthreshold Running Kept Simple](https://mybook.to/XzwWbK3)
- **Heat Calculator**: Methodology by [John Davis - Running Writings](https://apps.runningwritings.com/heat-adjusted-pace/)
- **Wind Calculator**: Methodology by [John Davis - Running Writings](https://apps.runningwritings.com/wind-calculator)
- **VDOT Formula**: Jack Daniels' Running Formula
- **Weather Data**: [Open-Meteo API](https://open-meteo.com/)
- **Geocoding**: [Nominatim OpenStreetMap](https://nominatim.org/)

##  Contact

Rapino Infeliz - [@github](https://github.com/rapinoinfeliz) [@email](rapinoinfeliz@gmail.com)

Project Link: [https://github.com/rapinoinfeliz/RunWeather](https://github.com/rapinoinfeliz/RunWeather)

---

**Note**: This calculator provides estimates based on scientific models. Individual responses to heat and wind vary. Always prioritize safety and listen to your body during training.
