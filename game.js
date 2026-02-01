/* --- 1. GAME STATE --- */
let gameState = {
    character: {
        name: "Galen",
        health: 100,
        maxHealth: 100,
        energy: 50,
        maxEnergy: 50,
        condition: "Normal",
        stats: {
            strength: 10,
            wit: 10,
            charm: 10
        },
        appearance: {
            clothing: "Tattered Rags",
            hair: "Messy Black Hair",
            eyes: "Tired Brown Eyes",
            face: "Smudged with Dirt"
        }
    },
    inventory: [
        // Ensure this path matches your folder exactly
        { id: "potion_health_1", name: "Small Potion", quantity: 1, description: "Restores 20 health.", image: "images/potion.jpg" }
    ],
    currentStoryNode: "start"
};

// Story data placeholder
let storyData = {}; 


/* --- 2. GAME ENGINE & LOGIC --- */

async function loadGameData() {
    try {
        const response = await fetch('./story.json');
        if (!response.ok) throw new Error("Failed to load story data. Status: " + response.status);
        storyData = await response.json();
        updateUI();
        renderStoryNode(gameState.currentStoryNode);
    } catch (error) {
        console.error("CRITICAL ERROR:", error);
        document.getElementById('story-section').innerHTML = 
            `<h2>Error loading game</h2><p>Could not load 'story.json'. Ensure you are running this on a local server.</p><p>Error: ${error.message}</p>`;
    }
}

// --- SAVE & LOAD SYSTEM ---
function saveGame() {
    const stateString = JSON.stringify(gameState);
    localStorage.setItem('textRPG_save', stateString);
    alert("Game Saved Successfully!");
}

function loadGame() {
    const savedState = localStorage.getItem('textRPG_save');
    if (!savedState) {
        alert("No saved game found!");
        return;
    }
    if (!confirm("Load your saved game? Any unsaved progress will be lost.")) return;

    try {
        gameState = JSON.parse(savedState);
        updateUI();
        renderStoryNode(gameState.currentStoryNode);
        alert("Game Loaded!");
    } catch (error) {
        console.error("Failed to load save:", error);
        alert("Error loading save file.");
    }
}


// --- UI UPDATES ---
function updateUI() {
    const char = gameState.character;
    
    const els = {
        name: document.getElementById('char-name'),
        health: document.getElementById('char-health'),
        energy: document.getElementById('char-energy'),
        cond: document.getElementById('char-condition'),
        inv: document.getElementById('inventory-btn')
    };

    if(els.name) els.name.textContent = char.name;
    if(els.health) els.health.textContent = `${char.health}/${char.maxHealth}`;
    if(els.energy) els.energy.textContent = `${char.energy}/${char.maxEnergy}`;
    if(els.cond) els.cond.textContent = char.condition;
    if(els.inv) els.inv.textContent = `INVENTORY (${gameState.inventory.length})`;
}


// --- INVENTORY SYSTEM ---

function hasItem(itemId, quantity = 1) {
    const item = gameState.inventory.find(i => i.id === itemId);
    if (!item) return false;
    return item.quantity >= quantity;
}

function updateInventory(action, itemData) {
    if (action === "add") {
        const existingItem = gameState.inventory.find(i => i.id === itemData.id);
        if (existingItem) {
            existingItem.quantity += itemData.quantity || 1;
        } else {
            gameState.inventory.push({ ...itemData });
        }
    } else if (action === "remove") {
        const itemIndex = gameState.inventory.findIndex(i => i.id === itemData.id);
        if (itemIndex > -1) {
            const item = gameState.inventory[itemIndex];
            item.quantity -= itemData.quantity || 1;
            if (item.quantity <= 0) {
                gameState.inventory.splice(itemIndex, 1);
            }
        }
    }
    updateUI();
}

function useItem(itemId) {
    if (itemId === "potion_health_1") {
        const char = gameState.character;

        if (char.health >= char.maxHealth) {
            alert("Your health is already full!");
            return;
        }

        const healAmount = 20;
        const oldHealth = char.health;
        char.health = Math.min(char.health + healAmount, char.maxHealth);
        const actualHealed = char.health - oldHealth;

        updateInventory("remove", { id: itemId, quantity: 1 });

        alert(`You drank the potion. Recovered ${actualHealed} HP.`);
        renderInventoryScreen();
    }
}


// --- TEXT PROCESSOR ---
function processText(text) {
    let processedText = text;
    for (const [key, value] of Object.entries(gameState.character.appearance)) {
        const placeholder = new RegExp(`{${key}}`, 'g');
        processedText = processedText.replace(placeholder, value);
    }
    processedText = processedText.replace(/{name}/g, gameState.character.name);
    return processedText;
}


// --- SCREEN RENDERERS ---

function renderStoryNode(nodeId) {
    const storySection = document.getElementById('story-section');
    const node = storyData[nodeId];

    if (!node) {
        storySection.innerHTML = `<h2>Error</h2><p>Node "${nodeId}" not found.</p><button id="back-to-start-btn" class="choice-btn">Go to Start</button>`;
        document.getElementById('back-to-start-btn').addEventListener('click', () => renderStoryNode('start'));
        return;
    }
    
    // --- BACKGROUND IMAGE LOGIC ---
    if (node.backgroundImage) {
        document.body.style.backgroundImage = `url('${node.backgroundImage}')`;
    } else {
        document.body.style.backgroundImage = 'none';
        document.body.style.backgroundColor = '#1a1a1a';
    }

    gameState.currentStoryNode = nodeId;
    
    let html = `<h2 class="chapter-title">${node.title}</h2>`;
    html += `<p class="story-paragraph">${processText(node.text)}</p>`;
    
    html += '<div class="choices-container">';
    if (node.choices) {
        node.choices.forEach((choice, index) => {
            let isDisabled = false;
            let choiceText = choice.text;

            if (choice.check) {
                const playerStat = gameState.character.stats[choice.check.stat];
                if (playerStat < choice.check.value) {
                    isDisabled = true;
                    choiceText += ` (Failed: ${playerStat}/${choice.check.value} ${choice.check.stat})`;
                }
            }
            if (choice.checkInventory) {
                if (!hasItem(choice.checkInventory.id, choice.checkInventory.quantity)) {
                    isDisabled = true;
                    const requiredItemName = choice.checkInventory.id.replace(/_/g, ' ');
                    choiceText += ` (Requires: ${requiredItemName})`;
                }
            }
            if (choice.checkAppearance) {
                for (const [key, reqValue] of Object.entries(choice.checkAppearance)) {
                    if (gameState.character.appearance[key] !== reqValue) {
                         isDisabled = true;
                         choiceText += ` (Requires: ${reqValue})`;
                    }
                }
            }

            html += `<button class="choice-btn" data-choice-index="${index}" ${isDisabled ? 'disabled' : ''}>${choiceText}</button>`;
        });
    }
    html += '</div>';

    storySection.innerHTML = html;
    storySection.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', handleChoice);
    });
}

function handleChoice(event) {
    const choiceIndex = event.target.getAttribute('data-choice-index');
    const currentNode = storyData[gameState.currentStoryNode];
    const choice = currentNode.choices[choiceIndex];

    // --- NEW: HARD RESET LOGIC FOR RESTART/DEATH ---
    if (choice.nextNode === "start") {
        gameState.inventory = [
            { 
                id: "potion_health_1", 
                name: "Small Potion", 
                quantity: 1, 
                description: "Restores 20 health.", 
                image: "images/potion.jpg" 
            }
        ];
    }
    // ----------------------------------------------

    if (choice.effects) {
        for (const key in choice.effects) {
            const effectValue = choice.effects[key];

            if (key in gameState.character && typeof gameState.character[key] !== 'object') {
                if (typeof effectValue === 'number') {
                    if (key === 'health' && effectValue === 100) gameState.character[key] = 100;
                    else if (key === 'energy' && effectValue === 50) gameState.character[key] = 50;
                    else gameState.character[key] += effectValue;
                } else {
                    gameState.character[key] = effectValue;
                }
            } 
            else if (key in gameState.character.appearance) {
                gameState.character.appearance[key] = effectValue;
            }
            else if (key in gameState.character.stats) {
                if (typeof effectValue === 'number') gameState.character.stats[key] += effectValue;
                else gameState.character.stats[key] = effectValue;
            }
        }
    }
    
    if (choice.inventoryEffect) {
        updateInventory(choice.inventoryEffect.action, choice.inventoryEffect.item);
    }

    updateUI();
    renderStoryNode(choice.nextNode);
}

// --- UPDATED INVENTORY SCREEN ---
function renderInventoryScreen() {
    const storySection = document.getElementById('story-section');
    
    let html = `<h2 class="chapter-title">Inventory</h2>`;
    html += '<div class="inventory-container">';
    
    if (gameState.inventory.length === 0) {
        html += '<p class="inventory-empty">Your inventory is empty.</p>';
    } else {
        gameState.inventory.forEach(item => {
            // Check for image, fallback to placeholder
            const imgSrc = item.image || `https://placehold.co/100x100/444444/e0e0e0?text=${item.name.split(' ').join('+')}`;

            html += `
                <div class="inventory-item">
                    <div class="inventory-item-image">
                        <img src="${imgSrc}" alt="${item.name}">
                    </div>
                    <div class="inventory-item-details">
                        <h3 class="item-name">${item.name} (x${item.quantity})</h3>
                        <p class="item-description">${item.description}</p>
            `;
            
            // "USE" button
            if (item.id === "potion_health_1") {
                html += `<button class="choice-btn use-item-btn" data-item-id="${item.id}" style="margin-top:10px; padding: 5px 10px; font-size: 0.8rem;">Use Item</button>`;
            }

            html += `   </div>
                </div>
            `;
        });
    }
    
    html += '</div>';
    html += '<button id="back-to-game-btn" class="choice-btn">Back to Game</button>';
    
    storySection.innerHTML = html;

    // EVENT LISTENERS MUST BE INSIDE THIS FUNCTION
    document.getElementById('back-to-game-btn').addEventListener('click', () => {
        renderStoryNode(gameState.currentStoryNode);
    });

    storySection.querySelectorAll('.use-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = e.target.getAttribute('data-item-id');
            useItem(itemId);
        });
    });
} 

function renderStatsScreen() {
    const storySection = document.getElementById('story-section');
    const char = gameState.character;
    let html = `<h2 class="chapter-title">Character Stats</h2>`;
    html += '<div class="stats-container">';
    html += `<p><strong>Name:</strong> ${char.name}</p>`;
    html += `<p><strong>Condition:</strong> ${char.condition}</p>`;
    html += '<h3 class="stats-header">Vitals</h3>';
    html += `<p><strong>Health:</strong> ${char.health} / ${char.maxHealth}</p>`;
    html += `<p><strong>Energy:</strong> ${char.energy} / ${char.maxEnergy}</p>`;
    html += '<h3 class="stats-header">Core Attributes</h3>';
    for (const [stat, value] of Object.entries(char.stats)) {
        const statName = stat.charAt(0).toUpperCase() + stat.slice(1);
        html += `<p><strong>${statName}:</strong> ${value}</p>`;
    }
    html += '</div>';
    html += '<button id="back-to-game-btn" class="choice-btn">Back to Game</button>';
    storySection.innerHTML = html;
    document.getElementById('back-to-game-btn').addEventListener('click', () => {
        renderStoryNode(gameState.currentStoryNode);
    });
}

function renderAppearanceScreen() {
    const storySection = document.getElementById('story-section');
    const app = gameState.character.appearance;
    let html = `<h2 class="chapter-title">Appearance</h2>`;
    html += `<div class="appearance-description-box">
                 <p>You are <strong>${gameState.character.name}</strong>.</p>
                 <p>You are wearing <strong>${app.clothing}</strong>.</p>
                 <p>You have <strong>${app.hair}</strong>.</p>
             </div>`;
    html += '<div class="stats-container">';
    html += '<h3 class="stats-header">Current Look</h3>';
    html += `<div class="appearance-item"><strong>Clothing:</strong> ${app.clothing}</div>`;
    html += `<div class="appearance-item"><strong>Hair:</strong> ${app.hair}</div>`;
    html += `<div class="appearance-item"><strong>Eyes:</strong> ${app.eyes}</div>`;
    html += `<div class="appearance-item"><strong>Face:</strong> ${app.face}</div>`;
    html += '</div>';
    html += '<button id="back-to-game-btn" class="choice-btn">Back to Game</button>';
    storySection.innerHTML = html;
    document.getElementById('back-to-game-btn').addEventListener('click', () => {
        renderStoryNode(gameState.currentStoryNode);
    });
}


/* --- 4. GAME START --- */
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Check for required elements
    const requiredIds = ['char-name', 'char-health', 'char-energy', 'char-condition', 'inventory-btn', 'story-section', 'save-btn', 'stats-btn', 'appearance-btn'];
    let allElementsFound = true;
    for (const id of requiredIds) {
        if (!document.getElementById(id)) {
            console.error(`ERROR: HTML element "${id}" missing.`);
            allElementsFound = false;
        }
    }
    if (!allElementsFound) return;

    // 2. Hook up Standard Buttons
    document.getElementById('save-btn').addEventListener('click', saveGame);
    
    const loadBtn = document.getElementById('load-btn');
    if(loadBtn) loadBtn.addEventListener('click', loadGame);

    document.getElementById('stats-btn').addEventListener('click', renderStatsScreen);
    document.getElementById('inventory-btn').addEventListener('click', renderInventoryScreen);
    document.getElementById('appearance-btn').addEventListener('click', renderAppearanceScreen);

    // 3. --- NEW: MOBILE MENU LOGIC ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');

    if (mobileMenuBtn && sidebar) {
        mobileMenuBtn.addEventListener('click', () => {
            // Toggle the 'active' class to slide sidebar in/out
            sidebar.classList.toggle('active');
            
            // Toggle button text
            if (sidebar.classList.contains('active')) {
                mobileMenuBtn.textContent = "✖ CLOSE";
            } else {
                mobileMenuBtn.textContent = "☰ MENU";
            }
        });
    }

    // Auto-close sidebar when clicking a navigation button (Better UX)
    const navButtons = document.querySelectorAll('.sidebar-button');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Only close if on mobile
            if (window.innerWidth <= 768 && sidebar) {
                sidebar.classList.remove('active');
                if(mobileMenuBtn) mobileMenuBtn.textContent = "☰ MENU";
            }
        });
    });

    // 4. KICKSTART
    loadGameData();
});