const mapEl = document.querySelector("#map");
const dayValue = document.querySelector("#dayValue");
const supplyValue = document.querySelector("#supplyValue");
const moraleValue = document.querySelector("#moraleValue");
const intelValue = document.querySelector("#intelValue");
const logEl = document.querySelector("#log");
const orderHint = document.querySelector("#orderHint");
const principleTitle = document.querySelector("#principleTitle");
const principleText = document.querySelector("#principleText");
const resultDialog = document.querySelector("#resultDialog");
const resultTitle = document.querySelector("#resultTitle");
const resultText = document.querySelector("#resultText");

const buttons = {
  move: document.querySelector("#moveBtn"),
  scout: document.querySelector("#scoutBtn"),
  feint: document.querySelector("#feintBtn"),
  rest: document.querySelector("#restBtn"),
};

const terrain = {
  P: { name: "plains", cost: 1 },
  F: { name: "forest", cost: 2 },
  M: { name: "mountain", cost: 3 },
  R: { name: "river", cost: 2 },
};

const layout = [
  "PPFPRFP",
  "PFFPRFP",
  "PPMPRFP",
  "RRMPRPP",
  "PPPPFMP",
  "PFFPFMP",
  "PPPPPPP",
];

const principles = [
  {
    title: "Laying Plans",
    text: "Every move spends supplies. Compare cost, distance, morale, and enemy position before committing.",
  },
  {
    title: "Attack by Stratagem",
    text: "A feint can move an enemy away from a road or stronghold. Winning without a costly fight is the best result.",
  },
  {
    title: "Use of Spies",
    text: "Scouting reveals hidden threats and lowers the cost of the next advance into uncertain ground.",
  },
  {
    title: "Terrain",
    text: "Passes and rivers slow an army. Forests hide scouts and ambushes. A direct road is not always the best road.",
  },
  {
    title: "Energy",
    text: "Rest restores morale, but time favors the defender. A long campaign drains the state.",
  },
];

let state;

function initialState() {
  return {
    day: 1,
    supplies: 18,
    morale: 8,
    intel: 2,
    position: { x: 0, y: 6 },
    goal: { x: 6, y: 0 },
    selectedOrder: "move",
    scouted: new Set(["0,6", "1,6", "0,5"]),
    exhaustedTiles: new Set(),
    enemies: [
      { x: 2, y: 5, strength: 2 },
      { x: 4, y: 4, strength: 3 },
      { x: 5, y: 2, strength: 2 },
      { x: 3, y: 1, strength: 3 },
    ],
    intelSites: new Set(["1,4", "3,5", "5,1"]),
    log: [
      "Campaign opened. The stronghold lies northeast; choose speed, secrecy, or recovery.",
    ],
    gameOver: false,
  };
}

function key(x, y) {
  return `${x},${y}`;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < 7 && y < 7;
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function enemyAt(x, y) {
  return state.enemies.find((enemy) => enemy.x === x && enemy.y === y);
}

function isAdjacent(x, y) {
  return distance(state.position, { x, y }) === 1;
}

function addLog(message) {
  state.log.push(`Day ${state.day}: ${message}`);
  state.log = state.log.slice(-8);
}

function setOrder(order) {
  state.selectedOrder = order;
  Object.entries(buttons).forEach(([name, button]) => {
    button.classList.toggle("active", name === order);
  });

  const hints = {
    move: "Choose an adjacent tile to advance.",
    scout: "Choose any nearby tile within two spaces to reveal danger. Costs 1 intel.",
    feint: "Choose an adjacent enemy to draw it away. Costs 2 intel and 1 morale.",
    rest: "Recover morale and a little supply, but lose a day.",
  };
  orderHint.textContent = hints[order];
  render();
}

function revealAround(x, y) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny)) state.scouted.add(key(nx, ny));
    }
  }
}

function advanceDay(extra = 1) {
  state.day += extra;
  if (state.day > 14) {
    state.supplies -= 1;
    state.morale -= 1;
    addLog("The drawn-out campaign is eroding both supply and spirit.");
  }
}

function moveTo(x, y) {
  if (!isAdjacent(x, y)) {
    addLog("A commander cannot outrun the army. Select an adjacent tile.");
    return;
  }

  const tileKey = key(x, y);
  const code = layout[y][x];
  let cost = terrain[code].cost;
  const isScouted = state.scouted.has(tileKey);
  const enemy = enemyAt(x, y);

  if (!isScouted) cost += 1;
  if (state.exhaustedTiles.has(tileKey)) cost += 1;

  state.supplies -= cost;
  state.position = { x, y };
  revealAround(x, y);

  if (enemy) {
    const prepared = isScouted ? 1 : 0;
    const loss = Math.max(1, enemy.strength - prepared);
    state.morale -= loss;
    state.supplies -= enemy.strength;
    state.enemies = state.enemies.filter((unit) => unit !== enemy);
    addLog(
      `Direct battle won, but it cost ${enemy.strength} supplies and ${loss} morale.`,
    );
  } else if (state.intelSites.has(tileKey)) {
    state.intel += 2;
    state.intelSites.delete(tileKey);
    addLog("Scouts found local guides. Intel increased by 2.");
  } else {
    addLog(`Advanced through ${terrain[code].name}; supply cost ${cost}.`);
  }

  state.exhaustedTiles.add(tileKey);
  advanceDay();
  checkEnd();
  render();
}

function scoutTile(x, y) {
  if (distance(state.position, { x, y }) > 2) {
    addLog("Scouts cannot range that far from the column.");
    return;
  }
  if (state.intel < 1) {
    addLog("No intelligence network remains. Recover or find guides.");
    return;
  }

  state.intel -= 1;
  revealAround(x, y);
  const enemy = enemyAt(x, y);
  const note = enemy
    ? "Scouts located an enemy screen before it could ambush you."
    : "Scouts mapped the ground and reduced uncertainty.";
  addLog(note);
  advanceDay();
  checkEnd();
  render();
}

function feintAt(x, y) {
  const enemy = enemyAt(x, y);
  if (!enemy || !isAdjacent(x, y)) {
    addLog("A feint needs an adjacent enemy formation.");
    return;
  }
  if (state.intel < 2 || state.morale < 2) {
    addLog("A feint needs 2 intel and enough morale to hold discipline.");
    return;
  }

  const options = [
    { x: enemy.x + 1, y: enemy.y },
    { x: enemy.x - 1, y: enemy.y },
    { x: enemy.x, y: enemy.y + 1 },
    { x: enemy.x, y: enemy.y - 1 },
  ].filter(
    (tile) =>
      inBounds(tile.x, tile.y) &&
      !enemyAt(tile.x, tile.y) &&
      key(tile.x, tile.y) !== key(state.goal.x, state.goal.y) &&
      distance(tile, state.position) > distance(enemy, state.position),
  );

  state.intel -= 2;
  state.morale -= 1;

  if (options.length) {
    const destination = options.sort(
      (a, b) => terrain[layout[a.y][a.x]].cost - terrain[layout[b.y][b.x]].cost,
    )[0];
    enemy.x = destination.x;
    enemy.y = destination.y;
    addLog("False signals pulled the enemy away without battle.");
  } else {
    state.supplies -= 1;
    addLog("The enemy did not move, but the feint bought time at low cost.");
  }

  advanceDay();
  checkEnd();
  render();
}

function recover() {
  state.morale = Math.min(10, state.morale + 2);
  state.supplies = Math.min(20, state.supplies + 1);
  addLog("The army recovered order. Time, however, still moved.");
  advanceDay(2);
  checkEnd();
  render();
}

function handleTileClick(x, y) {
  if (state.gameOver) return;
  if (state.selectedOrder === "move") moveTo(x, y);
  if (state.selectedOrder === "scout") scoutTile(x, y);
  if (state.selectedOrder === "feint") feintAt(x, y);
}

function checkEnd() {
  if (key(state.position.x, state.position.y) === key(state.goal.x, state.goal.y)) {
    state.gameOver = true;
    showResult(
      "Victory",
      `The stronghold fell on day ${state.day}. You won with ${Math.max(
        0,
        state.supplies,
      )} supplies and ${Math.max(0, state.morale)} morale remaining.`,
    );
  } else if (state.supplies <= 0 || state.morale <= 0) {
    state.gameOver = true;
    showResult(
      "Campaign Lost",
      "The army can no longer continue. Sun Tzu warns that prolonged, costly war consumes the state first.",
    );
  }
}

function showResult(title, text) {
  resultTitle.textContent = title;
  resultText.textContent = text;
  resultDialog.showModal();
}

function choosePrinciple() {
  if (state.selectedOrder === "feint") return principles[1];
  if (state.selectedOrder === "scout") return principles[2];
  if (state.selectedOrder === "rest") return principles[4];
  const code = layout[state.position.y][state.position.x];
  if (code === "M" || code === "R" || code === "F") return principles[3];
  return principles[0];
}

function render() {
  dayValue.textContent = state.day;
  supplyValue.textContent = Math.max(0, state.supplies);
  moraleValue.textContent = Math.max(0, state.morale);
  intelValue.textContent = state.intel;

  const principle = choosePrinciple();
  principleTitle.textContent = principle.title;
  principleText.textContent = principle.text;

  logEl.innerHTML = "";
  state.log.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    logEl.append(li);
  });

  mapEl.innerHTML = "";
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const tileKey = key(x, y);
      const code = layout[y][x];
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = `tile ${terrain[code].name}`;
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-label", `${terrain[code].name} tile ${x + 1}, ${y + 1}`);
      tile.classList.toggle("fog", !state.scouted.has(tileKey));
      tile.classList.toggle("selected", tileKey === key(state.position.x, state.position.y));
      tile.classList.toggle(
        "reachable",
        state.selectedOrder === "move" && isAdjacent(x, y),
      );
      tile.addEventListener("click", () => handleTileClick(x, y));

      if (tileKey === key(state.goal.x, state.goal.y)) {
        const goal = document.createElement("span");
        goal.className = "goal";
        goal.textContent = "G";
        tile.append(goal);
      }

      if (tileKey === key(state.position.x, state.position.y)) {
        const unit = document.createElement("span");
        unit.className = "unit";
        unit.textContent = "A";
        tile.append(unit);
      } else if (state.scouted.has(tileKey)) {
        const enemy = enemyAt(x, y);
        if (enemy) {
          const foe = document.createElement("span");
          foe.className = "foe";
          foe.textContent = enemy.strength;
          tile.append(foe);
        } else if (state.intelSites.has(tileKey)) {
          const intel = document.createElement("span");
          intel.className = "intel";
          intel.textContent = "?";
          tile.append(intel);
        }
      }

      const cost = document.createElement("span");
      cost.className = "terrain-cost";
      cost.textContent = terrain[code].cost;
      tile.append(cost);
      mapEl.append(tile);
    }
  }
}

function reset() {
  state = initialState();
  setOrder("move");
  resultDialog.close();
  render();
}

buttons.move.addEventListener("click", () => setOrder("move"));
buttons.scout.addEventListener("click", () => setOrder("scout"));
buttons.feint.addEventListener("click", () => setOrder("feint"));
buttons.rest.addEventListener("click", () => {
  setOrder("rest");
  recover();
});
document.querySelector("#resetBtn").addEventListener("click", reset);
document.querySelector("#dialogResetBtn").addEventListener("click", reset);

reset();
