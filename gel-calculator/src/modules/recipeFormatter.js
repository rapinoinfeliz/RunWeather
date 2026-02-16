// Recipe Formatter Logic

export const formatRecipeForCopy = (
    calculatedCarbData,
    electrolyteSources,
    isBatchMode,
    hours,
    gelsPerHour
) => {
    const totalGels = gelsPerHour * hours;
    const divisor = isBatchMode ? 1 : (totalGels > 0 ? totalGels : 1);
    const modeLabel = isBatchMode
        ? `Full Batch (${hours} hour${hours !== 1 ? 's' : ''})`
        : `Per Gel (${totalGels} total gels)`;

    let recipeText = `--- Recipe (${modeLabel}) ---\n\n`;

    const carbEntries = Object.entries(calculatedCarbData.finalGrams)
        .filter(([key, grams]) => key !== 'totalGrams' && typeof grams === 'number' && grams > 0.01);

    if (carbEntries.length > 0) {
        recipeText += "Carbohydrates:\n";
        carbEntries.forEach(([sourceName, totalGrams]) => {
            const amount = totalGrams / divisor;
            recipeText += `- ${sourceName}: ${amount.toFixed(1)}g\n`;
        });
        recipeText += "\n";
    } else {
        recipeText += "Carbohydrates: None\n\n";
    }

    const electrolyteEntries = electrolyteSources
        .filter(source => source.source && source.amount > 0.01);

    if (electrolyteEntries.length > 0) {
        recipeText += "Electrolytes:\n";
        electrolyteEntries.forEach(source => {
            const amount = source.amount / divisor;
            recipeText += `- ${source.source}: ${amount.toFixed(1)}mg\n`;
        });
        recipeText += "\n";
    } else {
        recipeText += "Electrolytes: None\n\n";
    }

    return recipeText.trim();
};

export const formatInstructionsForCopy = (
    carbIngredients, // Array<{name, amount, unit}>
    electrolyteIngredients,
    glucoseBasedCarbs,
    fructoseBasedCarbs,
    totalCarbs,
    isBatchMode,
    hours,
    gelsPerHour
) => {
    const totalGels = gelsPerHour * hours;
    const divisor = isBatchMode ? 1 : (totalGels > 0 ? totalGels : 1);

    let text = `--- DIY Gel/Drink Mix Instructions ---\n\n`;
    text += `Recipe makes: ${isBatchMode
        ? `One batch for ${hours} hour${hours !== 1 ? 's' : ''}`
        : `${totalGels} individual gel sachet${totalGels !== 1 ? 's' : ''} (${hours} hour${hours !== 1 ? 's' : ''})`
        }\n`;
    text += `Total Carbs: ${totalCarbs.toFixed(1)}g\n\n`;

    const formatList = (list) => {
        if (list.length === 0) return "  - None\n";
        return list.map(item => `  - ${item.name}: ${(item.amount / divisor).toFixed(1)}${item.unit}`).join('\n') + '\n';
    };

    text += "1. Gather Ingredients\n";
    text += "Collect all your measured ingredients. Ensure you have:\n";
    if (carbIngredients.length > 0) {
        text += " Carbohydrates:\n";
        text += formatList(carbIngredients);
    }
    if (electrolyteIngredients.length > 0) {
        text += " Electrolytes:\n";
        text += formatList(electrolyteIngredients);
    }
    if (carbIngredients.length === 0 && electrolyteIngredients.length === 0) {
        text += "  - No ingredients calculated yet.\n";
    }
    text += "Also prepare water (amount depends on desired consistency).\n\n";

    text += "2. Prepare Container\n";
    text += "Use a clean bottle or container with a secure lid, large enough for all ingredients and mixing water. A shaker bottle works well.\n";
    text += "Ensure it's completely dry before starting.\n\n";

    text += "3. Add Glucose Sources\n";
    text += "Add the following glucose-based carbohydrates to the empty container:\n";
    text += formatList(glucoseBasedCarbs);
    text += "\n";

    text += "4. Initial Mixing (Gel Base)\n";
    text += "Add a small amount of WARM (not hot) water - just enough to wet the powders.\n";
    text += "Seal the container and shake thoroughly until the mixture forms a thick, smooth gel-like paste. Break up any clumps.\n\n";

    text += "5. Add Remaining Ingredients\n";
    text += "Add the following ingredients to the gel base:\n";
    if (fructoseBasedCarbs.length > 0) {
        text += " Fructose Sources:\n";
        text += formatList(fructoseBasedCarbs);
    }
    if (electrolyteIngredients.length > 0) {
        text += " Electrolytes:\n";
        text += formatList(electrolyteIngredients);
    }
    if (fructoseBasedCarbs.length === 0 && electrolyteIngredients.length === 0) {
        text += "  - No remaining fructose or electrolyte sources to add.\n";
    }
    text += "\n";

    text += "6. Final Mixing & Consistency\n";
    text += "Gradually add more water (cold or room temp) while shaking until you reach your desired consistency.\n";
    text += "  - For thick gels: Use minimal water.\n";
    text += "  - For drink mix: Add more water (e.g., 500-750ml per hour of fuel).\n";
    text += "Shake vigorously until everything is fully dissolved and homogenous.\n\n";

    let storageStepNumber = 7;
    if (!isBatchMode) {
        text += "7. Fill Gel Sachets\n";
        text += "Carefully transfer the mixture into individual reusable gel flasks or disposable sachets.\n";
        text += "Leave a small air gap and seal them properly.\n\n";
        storageStepNumber = 8;
    }

    text += `${storageStepNumber}. Storage\n`;
    text += "Store the mixture in the refrigerator.\n";
    text += "Consume within 3-5 days for best results. The mixture may thicken when cold.\n";
    text += "Shake well before use.\n";

    return text.trim();
};
