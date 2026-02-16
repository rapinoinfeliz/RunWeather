// UI rendering module for Gel Calculator — Premium Edition
import {
    glucoseSourceOptions,
    fructoseSourceOptions,
    electrolyteSourceOptions,
    SWEAT_RATES,
    SWEAT_RATE_DESCRIPTIONS,
    SALTINESS_DESCRIPTIONS,
    initialActiveElectrolytes,
    sourceDataMap
} from './constants.js';

// ── Toast Notification ──

let toastTimer = null;
export function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── Sweat Rate & Saltiness Dropdowns ──

export function populateSweatRateSelect() {
    const sel = document.getElementById('sweat-rate-select');
    sel.innerHTML = '';
    SWEAT_RATES.forEach((rate, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${rate} L/h — ${SWEAT_RATE_DESCRIPTIONS[i].split(':')[0]}`;
        sel.appendChild(opt);
    });
}

export function populateSaltinessSelect() {
    const sel = document.getElementById('saltiness-select');
    sel.innerHTML = '';
    SALTINESS_DESCRIPTIONS.forEach((desc, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = desc.split(':')[0];
        sel.appendChild(opt);
    });
}


// ── Tooltips ──

export function setupTooltips() {
    const tooltip = document.getElementById('global-tooltip');
    if (!tooltip) return;

    const descriptionsMap = {
        'sweat-rate': SWEAT_RATE_DESCRIPTIONS,
        'saltiness': SALTINESS_DESCRIPTIONS
    };

    document.querySelectorAll('[data-tooltip-type]').forEach(el => {
        const type = el.dataset.tooltipType;
        const descriptions = descriptionsMap[type];

        if (!descriptions) return;

        const showTooltip = () => {
            tooltip.innerHTML = `
                <ul>
                    ${descriptions.map(desc => {
                const [title, ...rest] = desc.split(':');
                return `<li><strong>${title}:</strong> ${rest.join(':')}</li>`;
            }).join('')}
                </ul>
            `;

            // Position logic
            const rect = el.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            let top = rect.bottom + 8;
            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

            // Boundary checks
            if (left < 10) left = 10;
            if (left + tooltipRect.width > window.innerWidth - 10) {
                left = window.innerWidth - tooltipRect.width - 10;
            }

            tooltip.style.top = `${top + window.scrollY}px`;
            tooltip.style.left = `${left + window.scrollX}px`;
            tooltip.classList.add('show');
        };

        const hideTooltip = () => {
            tooltip.classList.remove('show');
        };

        // Mouse events
        el.addEventListener('mouseenter', showTooltip);
        el.addEventListener('mouseleave', hideTooltip);

        // Touch events (tap to toggle)
        el.addEventListener('touchstart', (e) => {
            e.preventDefault(); // prevent mouse emulation
            if (tooltip.classList.contains('show')) {
                hideTooltip();
            } else {
                showTooltip();
            }
        });

        // Close on outside click
        document.addEventListener('touchstart', (e) => {
            if (!el.contains(e.target) && !tooltip.contains(e.target)) {
                hideTooltip();
            }
        });
    });
}

// ── Manual Target Inputs ──

export function renderManualTargetInputs(manualTargets) {
    const grid = document.getElementById('manual-targets-grid');
    grid.innerHTML = '';
    for (const [elec, value] of Object.entries(manualTargets)) {
        const div = document.createElement('div');
        div.className = 'input-group';
        div.innerHTML = `
            <label>${elec} (mg/h)</label>
            <input type="number" class="manual-target-input" data-elec="${elec}" value="${value}" min="0">
        `;
        grid.appendChild(div);
    }
}

// ── Electrolyte Grid (cards with mini progress bars) ──

export function renderElectrolyteGrid(targetAmountsPerHour, activeElectrolytes, hours, calculateTotalContribution) {
    const grid = document.getElementById('electrolyte-grid');
    grid.innerHTML = '';
    for (const [elec, amount] of Object.entries(targetAmountsPerHour)) {
        const isActive = activeElectrolytes[elec];
        const totalTarget = amount * hours;
        const currentPerHour = calculateTotalContribution(elec);
        const currentTotal = currentPerHour * hours;
        const pct = totalTarget > 0 ? Math.min(100, (currentTotal / totalTarget) * 100) : 0;

        let barColor = 'var(--accent)';
        if (pct >= 95 && pct <= 110) barColor = 'var(--success)';
        else if (pct > 110) barColor = 'var(--orange)';
        else if (pct < 50 && totalTarget > 0 && currentTotal > 0) barColor = 'var(--danger)';

        const div = document.createElement('div');
        div.className = `elec-grid-item ${isActive ? 'active' : 'inactive'}`;
        div.dataset.elec = elec;
        div.innerHTML = `
            <div class="elec-name">${elec}</div>
            ${isActive ? `
                <div class="elec-detail">Target: ${totalTarget.toFixed(0)}mg</div>
                <div class="elec-detail">Current: ${currentTotal.toFixed(0)}mg</div>
                ${totalTarget > 0 ? `
                    <div class="elec-progress-wrap">
                        <div class="elec-progress-bar" style="width: ${pct}%; background: ${barColor};"></div>
                    </div>
                ` : ''}
            ` : '<div class="elec-detail" style="opacity:0.5;">Click to activate</div>'}
        `;
        grid.appendChild(div);
    }
}

// ── Carb Source Table Rows ──

function buildSourceSelect(options, selectedLabel, type, index) {
    let html = `<select class="select-input table-select" data-type="${type}" data-index="${index}">`;
    html += `<option value="">Select source...</option>`;
    for (const opt of options) {
        html += `<option value="${opt.label}" ${opt.label === selectedLabel ? 'selected' : ''}>${opt.label}</option>`;
    }
    html += '</select>';
    return html;
}

export function renderCarbSourceRows(type, sources, options, getSourceGrams, isPercentageValid) {
    const tbody = document.getElementById(`${type}-sources-tbody`);
    tbody.innerHTML = '';
    sources.forEach((source, index) => {
        const data = sourceDataMap.get(source.source);
        const grams = getSourceGrams(source.source);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${buildSourceSelect(options, source.source, type, index)}</td>
            <td class="num-cell">${data ? data.carbsPerGram.toFixed(2) : '—'}</td>
            <td class="num-cell">${data && grams > 0 ? (grams * (data.glucoseContent || 0) * data.carbsPerGram).toFixed(1) : '—'}</td>
            <td class="num-cell">${data && grams > 0 ? (grams * (data.fructoseContent || 0) * data.carbsPerGram).toFixed(1) : '—'}</td>
            <td><input type="number" class="pct-input ${!isPercentageValid ? 'error' : ''}" 
                data-type="${type}" data-index="${index}" 
                value="${source.percentage}" min="0" max="100" ${!source.source ? 'disabled' : ''}></td>
            <td class="grams-cell">${grams > 0 ? grams.toFixed(1) + 'g' : '—'}</td>
            <td>
                <button class="btn-remove" data-type="${type}" data-index="${index}" aria-label="Remove">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ── Electrolyte Source Table Rows ──

function buildElecSelect(selectedLabel, index) {
    let html = `<select class="select-input table-select" data-type="electrolyte" data-index="${index}">`;
    html += `<option value="">Select source...</option>`;
    for (const opt of electrolyteSourceOptions) {
        html += `<option value="${opt.label}" ${opt.label === selectedLabel ? 'selected' : ''}>${opt.label}</option>`;
    }
    html += '</select>';
    return html;
}

function formatProvides(source) {
    if (!source.source || source.components.length === 0) return '—';
    return source.components
        .filter(c => typeof c.amount === 'number' && c.amount > 0)
        .map(c => `${c.name}: ${c.amount.toFixed(1)}`)
        .join(', ') || '—';
}

function formatAbsorption(source) {
    if (!source.source || source.components.length === 0) return '—';
    return source.components
        .filter(c => typeof c.amount === 'number' && c.amount > 0)
        .map(c => `${c.name}: ${(c.absorptionRate * 100).toFixed(0)}%`)
        .join(', ') || '—';
}

export function renderElectrolyteSourceRows(sources) {
    const tbody = document.getElementById('electrolyte-sources-tbody');
    tbody.innerHTML = '';
    sources.forEach((source, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${buildElecSelect(source.source, index)}</td>
            <td><input type="number" class="amt-input" data-index="${index}" 
                value="${source.amount}" min="0" step="0.1" ${!source.source ? 'disabled' : ''}></td>
            <td class="provides-cell">${formatProvides(source)}</td>
            <td class="absorption-cell">${formatAbsorption(source)}</td>
            <td>
                <button class="btn-remove" data-type="electrolyte" data-index="${index}" aria-label="Remove">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ── Electrolyte Analysis (with progress bars) ──

export function renderElectrolyteAnalysis(analysis) {
    const container = document.getElementById('elec-analysis-list');
    container.innerHTML = '';
    if (analysis.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.75rem; padding: 8px 0;">No active electrolytes or targets set.</div>';
        return;
    }
    analysis.forEach(item => {
        const pctClamped = Math.min(100, Math.max(0, item.percentage));
        const pctStr = item.percentage === Infinity ? '∞' : `${item.percentage.toFixed(0)}%`;

        let progressClass = 'a-progress-default';
        let msgClass = 'a-msg-info';
        if (item.message.includes('Short') || item.message.includes('Need')) {
            progressClass = 'a-progress-short';
            msgClass = 'a-msg-short';
        } else if (item.message.includes('Excess')) {
            progressClass = 'a-progress-excess';
            msgClass = 'a-msg-excess';
        } else if (item.message.includes('met')) {
            progressClass = 'a-progress-met';
            msgClass = 'a-msg-met';
        }

        const div = document.createElement('div');
        div.className = 'analysis-item';
        div.innerHTML = `
            <div class="analysis-top-row">
                <span class="a-label">${item.electrolyte}</span>
                <span class="a-values">${item.absorbed.toFixed(1)} / ${item.target.toFixed(1)}mg (${pctStr})</span>
            </div>
            <div class="a-progress-wrap">
                <div class="a-progress-bar ${progressClass}" style="width: ${pctClamped}%;"></div>
            </div>
            <div class="a-message ${msgClass}">${item.message}</div>
        `;
        container.appendChild(div);
    });
}

// ── Visual Ratio Bar ──

export function updateRatioVisual(glucoseRatio, fructoseRatio) {
    const total = glucoseRatio + fructoseRatio;
    const gPct = total > 0 ? (glucoseRatio / total) * 100 : 50;
    const fPct = total > 0 ? (fructoseRatio / total) * 100 : 50;

    document.getElementById('ratio-fill-glucose').style.width = `${gPct}%`;
    document.getElementById('ratio-fill-fructose').style.width = `${fPct}%`;
    document.getElementById('glucose-pct-display').textContent = gPct.toFixed(0);
    document.getElementById('fructose-pct-display').textContent = fPct.toFixed(0);
}

// ── Stats Display ──

export function updateStats(totalCarbs, totalWeight) {
    document.getElementById('total-carbs-needed').textContent = totalCarbs.toFixed(0);
    document.getElementById('total-calories').textContent = Math.round(totalCarbs * 4);
    document.getElementById('total-weight').textContent = totalWeight > 0 ? totalWeight.toFixed(0) : '—';
}

// ── Recipe Rendering ──

export function renderRecipe(calculatedCarbData, carbTotals, electrolyteSources, isBatchMode, hours, gelsPerHour) {
    const container = document.getElementById('recipe-content');
    const totalGels = gelsPerHour * hours;
    const divisor = isBatchMode ? 1 : (totalGels > 0 ? totalGels : 1);

    const subtitleEl = document.getElementById('recipe-subtitle');
    if (isBatchMode) {
        subtitleEl.textContent = `Total ingredients for ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
        subtitleEl.textContent = `Per gel (${totalGels} total gels for ${hours}h)`;
    }

    const carbEntries = Object.entries(calculatedCarbData.finalGrams)
        .filter(([key, val]) => key !== 'totalGrams' && typeof val === 'number' && val > 0.01);

    const elecEntries = electrolyteSources
        .filter(s => s.source && s.amount > 0.01);

    let html = '';

    // Carbs summary
    html += '<div class="recipe-summary"><h4>Carbohydrates</h4>';
    if (carbEntries.length > 0) {
        html += '<div class="recipe-items">';
        for (const [name, totalGrams] of carbEntries) {
            const amount = totalGrams / divisor;
            html += `<div><span>${name}</span><span class="r-value">${amount.toFixed(1)}g</span></div>`;
        }
        html += '</div>';
    } else {
        html += '<div class="recipe-no-items">No carb sources selected yet.</div>';
    }
    html += '</div>';

    // Electrolytes summary
    html += '<div class="recipe-summary"><h4>Electrolytes</h4>';
    if (elecEntries.length > 0) {
        html += '<div class="recipe-items">';
        for (const source of elecEntries) {
            const amount = source.amount / divisor;
            html += `<div><span>${source.source}</span><span class="r-value">${amount.toFixed(1)}mg</span></div>`;
        }
        html += '</div>';
    } else {
        html += '<div class="recipe-no-items">No electrolytes configured yet.</div>';
    }
    html += '</div>';

    html += '</div>';

    // Sodium Warning
    const totalSodium = electrolyteSources.reduce((sum, source) => {
        const sodiumComp = source.components.find(c => c.name === 'Sodium');
        return sum + (sodiumComp ? sodiumComp.amount : 0);
    }, 0);
    const sodiumPerHour = hours > 0 ? totalSodium / hours : 0;

    if (sodiumPerHour > 3000) {
        html += `
            <div class="warning-box">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span>Sodium intake >3000 mg/h increases GI risk and electrolyte imbalance.</span>
                <div class="custom-tooltip">
                    <strong>High Sodium Warning</strong><br>
                    Sodium absorption is rate-limited. Highly concentrated solutions increase osmotic load, delay gastric emptying, and raise gastrointestinal risk. Do not exceed 3500 mg sodium per hour. Full replacement of potassium, magnesium, and calcium during exercise is generally unnecessary; excessive electrolyte intake may cause GI distress and fluid–electrolyte imbalance.
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// ── Recipe Modal ──

export function renderRecipeModal(calculatedCarbData, electrolyteSources, isBatchMode, hours, gelsPerHour) {
    const totalGels = gelsPerHour * hours;
    const divisor = isBatchMode ? 1 : (totalGels > 0 ? totalGels : 1);

    const carbEntries = Object.entries(calculatedCarbData.finalGrams)
        .filter(([key, val]) => key !== 'totalGrams' && typeof val === 'number' && val > 0.01);

    const glucoseBasedCarbs = [];
    const fructoseBasedCarbs = [];
    const totalCarbs = calculatedCarbData.finalGrams.totalGrams || 0;

    for (const [name, totalG] of carbEntries) {
        const item = { name, amount: totalG / divisor, unit: 'g' };
        const isFructoseOption = fructoseSourceOptions.some(o => o.label === name);
        if (isFructoseOption) {
            fructoseBasedCarbs.push(item);
        } else {
            glucoseBasedCarbs.push(item);
        }
    }

    const electrolyteIngredients = electrolyteSources
        .filter(s => s.source && s.amount > 0.01)
        .map(s => ({ name: s.source, amount: s.amount / divisor, unit: 'mg' }));

    const allCarbIngredients = [...glucoseBasedCarbs, ...fructoseBasedCarbs];

    // Meta
    const metaEl = document.getElementById('modal-meta');
    if (isBatchMode) {
        metaEl.textContent = `One batch for ${hours}h · ${(totalCarbs / divisor).toFixed(0)}g carbs · ${Math.round((totalCarbs / divisor) * 4)} kcal`;
    } else {
        metaEl.textContent = `${totalGels} gels for ${hours}h · ${(totalCarbs / divisor).toFixed(0)}g carbs/gel`;
    }

    // Sodium Warning Logic
    const totalSodium = electrolyteSources.reduce((sum, source) => {
        const sodiumComp = source.components.find(c => c.name === 'Sodium');
        return sum + (sodiumComp ? sodiumComp.amount : 0);
    }, 0);
    const sodiumPerHour = hours > 0 ? totalSodium / hours : 0;

    let warningHtml = '';
    if (sodiumPerHour > 3000) {
        warningHtml = `
            <div class="warning-box" style="margin-bottom: 20px; cursor: default;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span>Sodium intake >3000 mg/h increases GI risk and electrolyte imbalance.</span>
            </div>
        `;
    }

    const body = document.getElementById('modal-body');
    const formatList = items => {
        if (items.length === 0) return '<li style="opacity:0.5;">None</li>';
        return items.map(i => `<li><strong>${i.name}</strong>: ${i.amount.toFixed(1)}${i.unit}</li>`).join('');
    };

    const steps = [
        {
            title: 'Gather ingredients',
            content: `${allCarbIngredients.length > 0 ? `<p class="ing-label">Carbs:</p><ul>${formatList(allCarbIngredients)}</ul>` : ''}
                ${electrolyteIngredients.length > 0 ? `<p class="ing-label">Electrolytes:</p><ul>${formatList(electrolyteIngredients)}</ul>` : ''}
                <p>You'll also need water.</p>`
        },
        {
            title: 'Prepare container',
            content: `<p>Clean, dry bottle or shaker with a secure lid.</p>`
        },
        {
            title: 'Glucose sources first',
            content: `<p>Add to the empty container:</p>
                <ul>${formatList(glucoseBasedCarbs)}</ul>`
        },
        {
            title: 'Initial mix',
            content: `<p>Add a small amount of warm water — just enough to wet the powders. Shake until smooth.</p>`
        },
        {
            title: 'Add remaining ingredients',
            content: `${fructoseBasedCarbs.length > 0 ? `<p class="ing-label">Fructose:</p><ul>${formatList(fructoseBasedCarbs)}</ul>` : ''}
                ${electrolyteIngredients.length > 0 ? `<p class="ing-label">Electrolytes:</p><ul>${formatList(electrolyteIngredients)}</ul>` : ''}
                ${fructoseBasedCarbs.length === 0 && electrolyteIngredients.length === 0 ? '<p>Nothing else to add.</p>' : ''}`
        },
        {
            title: 'Adjust consistency',
            content: `<p>Gradually add cold water while shaking.</p>
                <ul>
                    <li><strong>Thick gel:</strong> minimal water</li>
                    <li><strong>Drink mix:</strong> ~500-750ml per hour of fuel</li>
                </ul>`
        }
    ];

    if (!isBatchMode) {
        steps.push({
            title: 'Fill sachets',
            content: `<p>Transfer into gel flasks. Leave a small air gap.</p>`
        });
    }

    steps.push({
        title: 'Storage',
        content: `<p>Refrigerate. Use within 3-5 days. Shake before use.</p>`
    });

    body.innerHTML = steps.map((s, i) => `
        <div class="recipe-step">
            <div class="step-number">${i + 1}</div>
            <div class="step-content">
                <h3>${s.title}</h3>
                ${s.content}
            </div>
        </div>
    `).join('');

    if (warningHtml) {
        body.insertAdjacentHTML('afterbegin', warningHtml);
    }
}

// ── Update Text Displays ──

export function updateHoursDisplays(hours) {
    ['elec-hours-display', 'elec-sources-hours', 'analysis-hours'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = hours;
    });
}

export function updateRatioBadges(glucoseVal, fructoseVal) {
    document.getElementById('glucose-parts-label').textContent = `${glucoseVal} part(s)`;
    document.getElementById('glucose-ratio-val').textContent = glucoseVal;
    document.getElementById('fructose-parts-label').textContent = `${fructoseVal} part(s)`;
    document.getElementById('fructose-ratio-val').textContent = fructoseVal;
}

export function updateTargetCarbs(glucoseTarget, fructoseTarget) {
    document.getElementById('target-glucose-carbs').textContent = glucoseTarget.toFixed(1);
    document.getElementById('target-fructose-carbs').textContent = fructoseTarget.toFixed(1);
}

export function showCarbErrors(carbTotals, isGlucosePctValid, isFructosePctValid) {
    const gErr = document.getElementById('glucose-error');
    const fErr = document.getElementById('fructose-error');
    const gPct = document.getElementById('glucose-pct-error');
    const fPct = document.getElementById('fructose-pct-error');
    const detailedMsg = document.getElementById('carb-detailed-msg');

    gPct.style.display = isGlucosePctValid ? 'none' : 'block';
    fPct.style.display = isFructosePctValid ? 'none' : 'block';

    if (!carbTotals.canAchieveRatio && carbTotals.message) {
        if (carbTotals.message.includes('glucose')) {
            gErr.textContent = carbTotals.message;
            gErr.style.display = 'block';
        } else {
            gErr.style.display = 'none';
        }
        if (carbTotals.message.includes('fructose')) {
            fErr.textContent = 'Consider adding a pure fructose source.';
            fErr.style.display = 'block';
        } else {
            fErr.style.display = 'none';
        }
        detailedMsg.textContent = carbTotals.message;
        detailedMsg.style.display = 'block';
    } else {
        gErr.style.display = 'none';
        fErr.style.display = 'none';
        detailedMsg.style.display = 'none';
    }
}
