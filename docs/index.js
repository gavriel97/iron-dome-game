// Get canvas and adjust to window size
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Resize canvas to fit window while maintaining aspect ratio
function resizeCanvas() {
  const aspectRatio = 4 / 3; // Or adjust to your background image ratio
  let width = window.innerWidth * 0.95;
  let height = width / aspectRatio;

  if (height > window.innerHeight * 0.9) {
    height = window.innerHeight * 0.9;
    width = height * aspectRatio;
  }

  canvas.width = width;
  canvas.height = height;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas(); // Initial size calculation

// --- Asset Loading ---
const assets = {
  interceptor: {
    img: document.getElementById("interceptorImg"),
    loaded: false,
  },
  ballisticThreat: {
    img: document.getElementById("ballisticThreatImg"),
    loaded: false,
  },
  cruiseThreat: {
    img: document.getElementById("cruiseThreatImg"),
    loaded: false,
  },
  droneThreat: {
    img: document.getElementById("droneThreatImg"),
    loaded: false,
  },
  ironDome: { img: document.getElementById("ironDomeImg"), loaded: false },
  background: { img: document.getElementById("backgroundImg"), loaded: false },
  // eranImg is only needed for the intro screen, not game loop
};

let assetsLoadedCount = 0;
const totalAssets = Object.keys(assets).length;
let allAssetsLoaded = false;

// Setup onload handlers for each asset
for (const key in assets) {
  assets[key].img.onload = () => {
    assets[key].loaded = true;
    assetsLoadedCount++;
    console.log(`${key} image loaded.`);
    if (assetsLoadedCount === totalAssets) {
      allAssetsLoaded = true;
      console.log("All game assets loaded.");
      // Optional: Enable start button only after assets are loaded
      // startBtn.disabled = false;
    }
  };
  assets[key].img.onerror = () => {
    console.error(`Failed to load image: ${assets[key].img.src}`);
    // Asset failed, but increment count to avoid blocking game start indefinitely
    // The draw function will need to handle missing assets
    assetsLoadedCount++;
    if (assetsLoadedCount === totalAssets) {
      allAssetsLoaded = true; // Allow game to start, but with potential visual issues
      console.warn("Some assets failed to load, proceeding anyway.");
    }
  };
  // Check if image is already cached/loaded
  if (assets[key].img.complete && assets[key].img.naturalHeight !== 0) {
    // Manually trigger handler if already loaded (e.g., from cache)
    assets[key].img.onload();
  }
}

// --- UI Elements ---
const droneCountEl = document.getElementById("droneCount");
const cruiseCountEl = document.getElementById("cruiseCount");
const ballisticCountEl = document.getElementById("ballisticCount");
const hitsEl = document.getElementById("hits");
const progressBar = document.getElementById("progressBar");
const intro = document.getElementById("intro");
const startBtn = document.getElementById("startBtn");
const ui = document.getElementById("ui");
const endScreen = document.getElementById("endScreen");
const endMessage = document.getElementById("endMessage");
const statsMessage = document.getElementById("statsMessage");
const endButton = document.getElementById("endButton");

// Optional: Disable start button until assets are loaded
// startBtn.disabled = true;

// --- Sound Effects --- (Same as before)
function playSound(type) {
  try {
    if (type === "explosion") {
      new Audio(
        "data:audio/mp3;base64,SUQzAwAAAAAAJlRQRTEAAAAcAAAAU291bmRKYXkuY29tIFNvdW5kIEVmZmVjdHNUQUxCAAAAGAAAAFNvdW5kIEVmZmVjdHMgLSBFeHBsb3Npb24="
      )
        .play()
        .catch((e) => {}); // Ignore potential errors
    } else {
      new Audio(
        "data:audio/mp3;base64,SUQzAwAAAAAAJlRQRTEAAAAcAAAAU291bmRKYXkuY29tIFNvdW5kIEVmZmVjdHNUQUxCAAAAGAAAAFNvdW5kIEVmZmVjdHMgLSBJbnRlcmNlcHQ="
      )
        .play()
        .catch((e) => {}); // Ignore potential errors
    }
  } catch (e) {
    // Silently fail if sound doesn't work
  }
}

// --- Game State --- (Same as before)
let threats = [],
  missiles = [],
  explosions = [],
  hits = 0,
  intercepted = 0;
const MAX_HITS = 10;
const counts = { drones: 170, cruise: 30, ballistic: 120 };
const totalThreats = counts.drones + counts.cruise + counts.ballistic;
let droneInterval, cruiseInterval, ballisticInterval;
let gameActive = false;
let gameStartTime, gameEndTime;

// --- Game Logic Functions --- (updateUI, spawnThreat, fireMissile, createExplosion, update, endGame - mostly unchanged)

function updateUI() {
  // Calculate remaining threats more accurately
  const remainingSpawns = counts.drones + counts.cruise + counts.ballistic;
  const activeThreats = threats.length;
  const currentTotalThreats = remainingSpawns + activeThreats;

  // Update counters
  droneCountEl.textContent = counts.drones;
  cruiseCountEl.textContent = counts.cruise;
  ballisticCountEl.textContent = counts.ballistic;
  hitsEl.textContent = hits;

  // Update progress bar based on threats destroyed or off-screen
  // Progress reflects threats dealt with (intercepted or hit ground) out of total
  const threatsDealtWith = totalThreats - currentTotalThreats;
  const progress = (threatsDealtWith / totalThreats) * 100;
  progressBar.style.width = Math.min(100, Math.max(0, progress)) + "%"; // Ensure value is between 0 and 100
}

function spawnThreat(type, speed, size) {
  // Color removed, decided by image
  const x = Math.random() * (canvas.width - size * 2) + size; // Keep within bounds slightly
  threats.push({
    x: x,
    y: -size, // Start off-screen
    type,
    speed,
    size, // Still useful for collision/drawing dimensions
    angle: Math.random() * Math.PI * 0.2 - Math.PI * 0.1, // Narrower random angle
    trail: [],
    rotation: 0, // Initial rotation (can adjust if sprites face specific direction)
  });
}

function setupSpawning() {
  // Clear any existing intervals
  clearInterval(droneInterval);
  clearInterval(cruiseInterval);
  clearInterval(ballisticInterval);

  // Adjust sizes based on your sprite dimensions if needed
  const droneSize = 30;
  const cruiseSize = 40;
  const ballisticSize = 50;

  // Spawn drones more frequently
  droneInterval = setInterval(() => {
    if (counts.drones > 0 && gameActive) {
      spawnThreat("drone", 1 + Math.random() * 0.5, droneSize);
      counts.drones--;
      updateUI();
    } else if (counts.drones <= 0 && !droneInterval._destroyed) {
      // Prevent multiple clears
      clearInterval(droneInterval);
      droneInterval._destroyed = true;
    }
  }, 800); // Slightly slower drone spawn

  // Spawn cruise missiles less frequently
  cruiseInterval = setInterval(() => {
    if (counts.cruise > 0 && gameActive) {
      spawnThreat("cruise", 2 + Math.random() * 0.7, cruiseSize);
      counts.cruise--;
      updateUI();
    } else if (counts.cruise <= 0 && !cruiseInterval._destroyed) {
      clearInterval(cruiseInterval);
      cruiseInterval._destroyed = true;
    }
  }, 2800); // Slightly slower cruise spawn

  // Spawn ballistic missiles rarely but they're faster
  ballisticInterval = setInterval(() => {
    if (counts.ballistic > 0 && gameActive) {
      spawnThreat("ballistic", 3 + Math.random() * 1, ballisticSize);
      counts.ballistic--;
      updateUI();
    } else if (counts.ballistic <= 0 && !ballisticInterval._destroyed) {
      clearInterval(ballisticInterval);
      ballisticInterval._destroyed = true;
    }
  }, 4500); // Slightly slower ballistic spawn
}

function fireMissile(x, y) {
  if (!gameActive || !assets.interceptor.loaded) return; // Don't fire if image not ready

  const startX = canvas.width / 2;
  const startY =
    canvas.height -
    (assets.ironDome.loaded ? assets.ironDome.img.height / 3 : 30); // Start from top of dome base
  const dx = x - startX;
  const dy = y - startY;
  const angle = Math.atan2(dy, dx);
  const interceptorSize = { width: 24, height: 48 }; // Match drawImage dimensions

  missiles.push({
    x: startX,
    y: startY,
    tx: x,
    ty: y,
    speed: 10, // Faster interceptor
    trail: [],
    angle: angle + Math.PI / 2, // Adjust angle for sprite orientation (upwards)
    width: interceptorSize.width,
    height: interceptorSize.height,
  });

  playSound("intercept");
}

function createExplosion(x, y, color) {
  explosions.push({
    x: x,
    y: y,
    radius: 5,
    maxRadius: 40 + Math.random() * 20, // Variable explosion size
    growSpeed: 3 + Math.random(),
    shrinkSpeed: 1.5,
    color: color,
    alpha: 1,
  });
}

// --- Event Listeners --- (Same as before)
canvas.addEventListener("click", (e) => {
  if (!gameActive) return;

  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (canvas.width / r.width);
  const y = (e.clientY - r.top) * (canvas.height / r.height);
  fireMissile(x, y);
});

// --- Game Logic Update ---
function update() {
  if (!gameActive) return;

  // Update threats
  threats.forEach((t) => {
    // Simple trail
    if (Math.random() > 0.6) {
      t.trail.push({ x: t.x, y: t.y, alpha: 0.8 });
    }
    t.trail = t.trail.filter((pt) => {
      pt.alpha -= 0.08;
      return pt.alpha > 0;
    });

    // Move based on type (ballistic drops faster, cruise/drone have angle)
    if (t.type === "ballistic") {
      t.y += t.speed * 1.2; // Faster vertical drop
    } else {
      t.x += Math.sin(t.angle) * t.speed * 0.5; // Slower horizontal drift
      t.y += t.speed;
    }

    // Keep within horizontal bounds (simple bounce)
    if (t.x < t.size / 2 || t.x > canvas.width - t.size / 2) {
      t.angle = -t.angle; // Reverse horizontal direction component
      t.x = Math.max(t.size / 2, Math.min(canvas.width - t.size / 2, t.x)); // Prevent getting stuck
    }

    // Basic rotation for effect
    // t.rotation += 0.01; // If sprites look better rotating
  });

  // Update missiles
  missiles.forEach((m) => {
    if (Math.random() > 0.4) {
      m.trail.push({ x: m.x, y: m.y, alpha: 1 });
    }
    m.trail = m.trail.filter((pt) => {
      pt.alpha -= 0.15;
      return pt.alpha > 0;
    });

    const dx = m.tx - m.x;
    const dy = m.ty - m.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > m.speed) {
      m.x += (dx / dist) * m.speed;
      m.y += (dy / dist) * m.speed;
      // Angle updated only when moving - already set correctly on fire
      // m.angle = Math.atan2(dy, dx) + Math.PI / 2; // Sprite points up
    } else {
      // Reached target point - create explosion and remove missile
      m.reachedTarget = true; // Mark for removal
      createExplosion(m.tx, m.ty, "#fff"); // Explosion at target point
      playSound("explosion");
    }
  });

  // Remove missiles that reached their target
  missiles = missiles.filter((m) => !m.reachedTarget);

  // Update explosions (Same as before)
  explosions = explosions.filter((e) => {
    if (e.radius < e.maxRadius) {
      e.radius += e.growSpeed;
    } else {
      e.radius -= e.shrinkSpeed;
      e.alpha -= 0.05;
    }
    return e.alpha > 0 && e.radius > 0;
  });

  // Check for hits on ground
  for (let i = threats.length - 1; i >= 0; i--) {
    const t = threats[i];
    // Use bottom edge of sprite for ground collision
    if (t.y + t.size / 2 > canvas.height) {
      createExplosion(t.x, canvas.height, "orange"); // Ground explosion
      playSound("explosion");
      threats.splice(i, 1);
      hits++;
      updateUI();
      if (hits >= MAX_HITS) {
        endGame(false);
        return; // Stop update loop immediately on loss
      }
    }
  }

  // Check for missile interceptions
  for (let i = threats.length - 1; i >= 0; i--) {
    const t = threats[i];
    let interceptedByMissile = false;
    for (let j = missiles.length - 1; j >= 0; j--) {
      const m = missiles[j];
      // Simple distance check between centers
      const dist = Math.hypot(t.x - m.x, t.y - m.y);
      // Check collision based on combined sizes (approximate)
      if (dist < (t.size / 2 + m.width / 2) * 0.8) {
        // 80% overlap needed
        createExplosion(
          t.x,
          t.y,
          t.type === "drone" ? "lime" : t.type === "cruise" ? "yellow" : "red"
        );
        playSound("explosion");
        threats.splice(i, 1);
        missiles.splice(j, 1); // Remove the intercepting missile
        intercepted++;
        interceptedByMissile = true;
        updateUI();
        break; // Threat is gone, move to next threat
      }
    }
  }

  // Check win condition
  if (
    counts.drones <= 0 &&
    counts.cruise <= 0 &&
    counts.ballistic <= 0 &&
    threats.length === 0 &&
    gameActive // Ensure game hasn't already ended
  ) {
    // Add a small delay to ensure last explosion renders
    setTimeout(() => {
      if (gameActive) endGame(true); // Check gameActive again in case of race condition with loss
    }, 500);
  }
}

// --- Drawing Function --- (MODIFIED heavily)
function draw() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background image if loaded
  if (assets.background.loaded) {
    ctx.drawImage(assets.background.img, 0, 0, canvas.width, canvas.height);
  } else {
    // Fallback background
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Draw simple stars as fallback
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 50; i++) {
      ctx.fillRect(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        1,
        1
      );
    }
  }

  // --- Draw Trails (before sprites) ---
  ctx.lineWidth = 2;
  // Threat trails
  threats.forEach((t) => {
    const trailColor =
      t.type === "drone"
        ? "rgba(0,255,0,0.6)"
        : t.type === "cruise"
        ? "rgba(255,255,0,0.6)"
        : "rgba(255,0,0,0.6)";
    t.trail.forEach((pt) => {
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = trailColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  // Missile trails
  missiles.forEach((m) => {
    m.trail.forEach((pt) => {
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = "rgba(180, 180, 255, 0.7)"; // Light blue/purple trail
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  ctx.globalAlpha = 1; // Reset global alpha

  // --- Draw Threats (Sprites) ---
  threats.forEach((t) => {
    let imgToDraw = null;
    let imgLoaded = false;

    // Select the correct image based on type
    if (t.type === "drone" && assets.droneThreat.loaded) {
      imgToDraw = assets.droneThreat.img;
      imgLoaded = true;
    } else if (t.type === "cruise" && assets.cruiseThreat.loaded) {
      imgToDraw = assets.cruiseThreat.img;
      imgLoaded = true;
    } else if (t.type === "ballistic" && assets.ballisticThreat.loaded) {
      imgToDraw = assets.ballisticThreat.img;
      imgLoaded = true;
    }

    if (imgLoaded) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation); // Apply rotation if needed
      // Draw image centered: drawImage(image, -width/2, -height/2, width, height)
      ctx.drawImage(imgToDraw, -t.size / 2, -t.size / 2, t.size, t.size);
      ctx.restore();
    } else {
      // Fallback drawing (original shapes) if image not loaded
      ctx.fillStyle =
        t.type === "drone" ? "lime" : t.type === "cruise" ? "yellow" : "red";
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size / 2, 0, Math.PI * 2); // Use half size for radius
      ctx.fill();
      // Add simple shape differentiators as fallback
      if (t.type === "drone") {
        ctx.strokeRect(t.x - t.size / 2, t.y - t.size / 2, t.size, t.size);
      }
      if (t.type === "ballistic") {
        ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
      } // Small square in middle
    }
  });

  // --- Draw Interceptor Missiles (Sprites) ---
  missiles.forEach((m) => {
    if (assets.interceptor.loaded) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      // Draw image centered based on its dimensions used in fireMissile
      ctx.drawImage(
        assets.interceptor.img,
        -m.width / 2,
        -m.height / 2,
        m.width,
        m.height
      );
      ctx.restore();
    } else {
      // Fallback drawing for interceptor
      ctx.fillStyle = "#ddd";
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.closePath();
      ctx.fill(); // Simple triangle
      ctx.fillStyle = "orange";
      ctx.fillRect(-2, 0, 4, 6); // Simple flame
      ctx.restore();
    }
  });

  // --- Draw Explosions (Same as before) ---
  explosions.forEach((e) => {
    ctx.globalAlpha = e.alpha;
    const gradient = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)"); // Brighter center
    gradient.addColorStop(0.5, e.color); // Color fades quicker
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1; // Reset global alpha

  // --- Draw Iron Dome Base (Sprite) ---
  if (assets.ironDome.loaded) {
    const img = assets.ironDome.img;
    // Adjust width/height as needed for your sprite size
    const domeWidth = 100;
    const domeHeight = 50; // Assuming sprite aspect ratio allows this
    const domeX = canvas.width / 2 - domeWidth / 2;
    const domeY = canvas.height - domeHeight;
    ctx.drawImage(img, domeX, domeY, domeWidth, domeHeight);
  } else {
    // Fallback drawing for Iron Dome base
    ctx.fillStyle = "#888";
    const baseWidth = 60;
    const baseHeight = 30;
    ctx.fillRect(
      canvas.width / 2 - baseWidth / 2,
      canvas.height - baseHeight,
      baseWidth,
      baseHeight
    );
    ctx.fillStyle = "#666";
    ctx.beginPath();
    ctx.arc(
      canvas.width / 2,
      canvas.height - baseHeight,
      baseWidth / 2,
      Math.PI,
      2 * Math.PI
    );
    ctx.fill();
  }
}

// --- Game Loop ---
function gameLoop() {
  if (!gameActive) return; // Exit if game ended

  update();
  draw(); // Pass canvas context

  requestAnimationFrame(gameLoop); // Continue loop
}

function endGame(isVictory) {
  // Prevent multiple calls / ending after already ended
  if (!gameActive) return;
  gameActive = false;

  // Stop spawning
  clearInterval(droneInterval);
  clearInterval(cruiseInterval);
  clearInterval(ballisticInterval);
  droneInterval = cruiseInterval = ballisticInterval = null; // Clear interval IDs

  gameEndTime = Date.now();
  const gameDuration = gameStartTime
    ? Math.floor((gameEndTime - gameStartTime) / 1000)
    : 0;

  // Clear any remaining missiles/threats visually (optional)
  // threats = []; missiles = []; explosions = []; draw();

  if (isVictory) {
    endMessage.textContent = "Mission Accomplished! Israel is safe.";
    endMessage.style.color = "#4CAF50";
  } else {
    endMessage.textContent =
      "Mission Failed: Israel has sustained critical damage.";
    endMessage.style.color = "#f44336";
  }

  const performance = isVictory
    ? hits === 0
      ? "Flawless"
      : "Excellent"
    : intercepted > totalThreats / 2
    ? "Valiant Effort"
    : "Needs Improvement";

  statsMessage.innerHTML = `
          <strong>Mission Statistics:</strong><br>
          Time elapsed: ${gameDuration} seconds<br>
          Threats intercepted: ${intercepted} / ${totalThreats}<br>
          Hits taken: ${hits} / ${MAX_HITS}<br>
          Overall performance: ${performance}
      `;

  ui.style.display = "none"; // Hide game UI
  endScreen.style.display = "block";
}

function startGame() {
  // Ensure assets are loaded before starting, or show a message
  if (!allAssetsLoaded) {
    // Maybe show a loading indicator instead of just logging
    console.warn("Assets not fully loaded yet, please wait.");
    // alert("Loading assets, please wait..."); // Simple feedback
    // Re-check after a short delay
    setTimeout(startGame, 500);
    return;
  }

  intro.style.display = "none";
  canvas.style.display = "block"; // Show canvas
  ui.style.display = "block"; // Show UI
  endScreen.style.display = "none";

  // Reset game state
  threats = [];
  missiles = [];
  explosions = [];
  hits = 0;
  intercepted = 0;
  counts.drones = 170;
  counts.cruise = 30;
  counts.ballistic = 120;

  updateUI(); // Initialize UI counts and progress bar
  gameActive = true;
  gameStartTime = Date.now();

  // Ensure canvas is sized correctly before starting spawns/loop
  resizeCanvas();

  setupSpawning();
  gameLoop(); // Start the main game loop
}

// Event listeners for buttons
startBtn.onclick = startGame;
endButton.onclick = startGame; // Restart game

// Initial setup
resizeCanvas(); // Call resize once on load
intro.style.display = "block"; // Show intro initially
canvas.style.display = "none"; // Hide canvas initially
ui.style.display = "none"; // Hide game UI initially
