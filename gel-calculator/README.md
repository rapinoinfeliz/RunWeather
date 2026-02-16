# Gel Calculator

Calculate personalized energy gel and drink mix recipes for endurance activities. Control the glucose-to-fructose ratio, select carbohydrate and electrolyte sources, and get step-by-step mixing instructions.

## Features

- **Carb ratio control** — adjust glucose and fructose pathway ratios with sliders
- **Multiple carb sources** — maltodextrin, dextrose, sucrose, fructose, maple syrup, etc.
- **Electrolyte targeting** — estimate needs from sweat profile or set manual targets (mg/h)
- **Auto-calculate electrolytes** — one click to fill electrolyte sources based on targets
- **Recipe view** — full batch or per-gel amounts with copy-to-clipboard
- **Mixing instructions** — step-by-step guide in a modal
- **State persistence** — your settings are saved in localStorage
- **Dark theme** — clean, minimal dark UI

## Running locally

No dependencies or build step needed. Just serve the static files:

```bash
npx -y http-server . -p 8080
```

Open [http://localhost:8080](http://localhost:8080)

## Project structure

```
index.html              Entry point
style.css               Styles
src/
  main.js               App state, events, orchestration
  modules/
    constants.js         Source data, sweat rates, conversion factors
    carbCalculator.js    Carb distribution logic
    electrolyteCalculator.js  Electrolyte auto-calc
    recipeFormatter.js   Text formatting for copy
    storage.js           localStorage persistence
    ui.js                DOM rendering
```

## License

[MIT](LICENSE.md)
