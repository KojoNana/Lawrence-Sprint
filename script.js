(() => {
  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const scoreElement = document.querySelector("#score");
  const shardsElement = document.querySelector("#shards");
  const bestElement = document.querySelector("#best-score");
  const statusElement = document.querySelector("#status-label");
  const overlay = document.querySelector("#game-overlay");
  const overlayKicker = document.querySelector("#overlay-kicker");
  const overlayTitle = document.querySelector("#overlay-title");
  const overlayCopy = document.querySelector("#overlay-copy");
  const buttonLabel = document.querySelector("#button-label");
  const overlayHint = document.querySelector("#overlay-hint");
  const shieldIndicator = document.querySelector("#shield-indicator");
  const playButton = document.querySelector("#play-button");
  const pauseButton = document.querySelector("#pause-button");
  const pauseLabel = document.querySelector("#pause-label");
  const mobileJump = document.querySelector("#mobile-jump");

  const floorRatio = 0.79;
  const gravity = 1850;
  const player = { x: 0, y: 0, width: 31, height: 43, velocityY: 0, grounded: true, jumpsRemaining: 2, shield: false, shieldTime: 0 };
  const obstacles = [];
  const pickups = [];
  const particles = [];
  const skyline = [];
  let width = 0;
  let height = 0;
  let floor = 0;
  let state = "ready";
  let elapsed = 0;
  let distance = 0;
  let shards = 0;
  let speed = 300;
  let obstacleTimer = 1.2;
  let pickupTimer = 2.3;
  let lastTime = 0;
  let sceneryOffset = 0;
  let trailTimer = 0;
  let shakeTime = 0;
  let shakePower = 0;
  let best = readBest();

  function readBest() {
    try {
      return Number(localStorage.getItem("lawrence-sprint-best")) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("lawrence-sprint-best", String(best));
    } catch {
      // The game remains playable when browser storage is unavailable.
    }
  }

  function formatScore(value) {
    return String(Math.floor(value)).padStart(5, "0");
  }

  bestElement.textContent = formatScore(best);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    floor = height * floorRatio;
    player.x = Math.max(50, Math.min(115, width * .15));
    player.y = Math.min(player.y || floor - player.height, floor - player.height);
    createSkyline();
  }

  function createSkyline() {
    skyline.length = 0;
    let x = -8;
    while (x < width + 60) {
      const buildingWidth = 22 + Math.random() * 48;
      skyline.push({ x, width: buildingWidth, height: 35 + Math.random() * height * .37, seed: Math.random() });
      x += buildingWidth + 7 + Math.random() * 13;
    }
  }

  function roundedRect(x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x + w, y + h, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground(dt) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#11192e");
    sky.addColorStop(.64, "#1c2440");
    sky.addColorStop(1, "#252b43");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const moon = ctx.createRadialGradient(width * .78, height * .23, 3, width * .78, height * .23, 48);
    moon.addColorStop(0, "rgba(204, 241, 161, .27)");
    moon.addColorStop(1, "rgba(204, 241, 161, 0)");
    ctx.fillStyle = moon;
    ctx.fillRect(width * .78 - 50, height * .23 - 50, 100, 100);
    ctx.fillStyle = "#d4e6b7";
    ctx.globalAlpha = .8;
    ctx.beginPath();
    ctx.arc(width * .78, height * .23, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    for (let i = 0; i < 45; i++) {
      const x = (i * 97.31 + 17) % width;
      const y = (i * 53.17 + 13) % (height * .59);
      ctx.globalAlpha = .2 + (i % 3) * .11;
      ctx.fillStyle = i % 7 === 0 ? "#d3ff72" : "#cbd8f3";
      ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;

    const skylineSpeed = state === "running" ? speed * .12 : state === "paused" ? 0 : 12;
    sceneryOffset = (sceneryOffset + skylineSpeed * dt) % 70;
    skyline.forEach((building) => {
      const x = ((building.x - sceneryOffset + width + 80) % (width + 80)) - 40;
      const y = floor - building.height;
      ctx.fillStyle = "#1a2038";
      ctx.fillRect(x, y, building.width, building.height);
      ctx.fillStyle = "rgba(180, 218, 154, .34)";
      for (let row = 0; row < Math.floor(building.height / 16); row++) {
        for (let col = 0; col < Math.floor(building.width / 13); col++) {
          if (((row * 3 + col * 7 + Math.floor(building.seed * 10)) % 5) < 2) {
            ctx.fillRect(x + 6 + col * 13, y + 9 + row * 16, 3, 5);
          }
        }
      }
    });

    ctx.fillStyle = "#252b42";
    ctx.fillRect(0, floor, width, height - floor);
    const groundGradient = ctx.createLinearGradient(0, floor, 0, height);
    groundGradient.addColorStop(0, "rgba(211, 255, 114, .11)");
    groundGradient.addColorStop(.06, "rgba(211, 255, 114, .025)");
    groundGradient.addColorStop(1, "rgba(10, 15, 29, .16)");
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, floor, width, height - floor);
    ctx.fillStyle = "rgba(211, 255, 114, .7)";
    ctx.fillRect(0, floor, width, 1);

    ctx.strokeStyle = "rgba(155, 177, 218, .075)";
    ctx.lineWidth = 1;
    for (let x = -(sceneryOffset * 1.6 % 58); x < width; x += 58) {
      ctx.beginPath();
      ctx.moveTo(x, floor + 1);
      ctx.lineTo(x - 35, height);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(168, 186, 224, .11)";
    for (let y = floor + 24; y < height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawRunner() {
    const bob = player.grounded && state === "running" ? Math.sin(elapsed * 17) * 2 : 0;
    const x = player.x;
    const y = player.y + bob;
    const midX = x + player.width / 2;

    if (player.shield) {
      ctx.beginPath();
      ctx.arc(midX, y + player.height / 2, 34 + Math.sin(elapsed * 8) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(211, 255, 114, .7)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(211, 255, 114, .07)";
      ctx.fill();
    }

    ctx.fillStyle = "rgba(6, 10, 23, .35)";
    ctx.beginPath();
    ctx.ellipse(midX, floor + 3, 24 * Math.max(.45, 1 - (floor - (y + player.height)) / 120), 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = "#8df7df";
    ctx.shadowBlur = 17;
    roundedRect(x + 4, y + 15, 23, 25, 7);
    ctx.fillStyle = "#76e8d1";
    ctx.fill();
    ctx.shadowBlur = 0;
    roundedRect(x + 7, y + 1, 19, 20, 7);
    ctx.fillStyle = "#c5fff0";
    ctx.fill();
    roundedRect(x + 11, y + 8, 13, 5, 2);
    ctx.fillStyle = "#293b52";
    ctx.fill();
    roundedRect(x + 17, y + 8, 4, 3, 1);
    ctx.fillStyle = "#d3ff72";
    ctx.fill();
    ctx.restore();

    const legSwing = player.grounded && state === "running" ? Math.sin(elapsed * 17) * 5 : 0;
    ctx.strokeStyle = "#c5fff0";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 37);
    ctx.lineTo(x + 9 - legSwing, y + 43);
    ctx.moveTo(x + 21, y + 37);
    ctx.lineTo(x + 22 + legSwing, y + 43);
    ctx.stroke();
  }

  function drawObstacle(obstacle) {
    const gradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x + obstacle.width, obstacle.y + obstacle.height);
    gradient.addColorStop(0, "#fc7b72");
    gradient.addColorStop(1, "#ab4e73");
    ctx.save();
    ctx.shadowColor = "rgba(255, 104, 119, .34)";
    ctx.shadowBlur = 15;
    roundedRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 5);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 231, 210, .55)";
    roundedRect(obstacle.x + 5, obstacle.y + 6, 3, 3, 1);
    ctx.fill();
    roundedRect(obstacle.x + obstacle.width - 9, obstacle.y + 6, 3, 3, 1);
    ctx.fill();
    ctx.strokeStyle = "rgba(46, 34, 57, .38)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(obstacle.x + 5, obstacle.y + obstacle.height - 8);
    ctx.lineTo(obstacle.x + obstacle.width - 5, obstacle.y + obstacle.height - 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawPickup(pickup) {
    const pulse = 1 + Math.sin(elapsed * 7 + pickup.phase) * .12;
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.rotate(Math.PI / 4);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = pickup.type === "shield" ? "#d3ff72" : "#ffe383";
    ctx.shadowBlur = 18;
    ctx.fillStyle = pickup.type === "shield" ? "#d3ff72" : "#ffe383";
    ctx.fillRect(-7, -7, 14, 14);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff9db";
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }

  function spawnObstacle() {
    const tall = Math.random() < .26;
    const obstacleHeight = tall ? 47 + Math.random() * 10 : 30 + Math.random() * 12;
    const obstacleWidth = tall ? 31 : 25 + Math.random() * 9;
    obstacles.push({ x: width + 25, y: floor - obstacleHeight, width: obstacleWidth, height: obstacleHeight });
  }

  function spawnPickup() {
    const type = Math.random() < .17 ? "shield" : "shard";
    pickups.push({
      x: width + 20,
      y: floor - (70 + Math.random() * 70),
      type,
      phase: Math.random() * Math.PI * 2
    });
  }

  function emitParticles(x, y, color, amount = 8) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 45 + Math.random() * 150;
      particles.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: .35 + Math.random() * .45,
        maxLife: .8,
        size: 2 + Math.random() * 3,
        color
      });
    }
  }

  function jump() {
    if (state === "ready" || state === "over") {
      startGame();
      return;
    }
    if (state === "paused") {
      resumeGame();
      return;
    }
    if (state === "running" && player.jumpsRemaining > 0) {
      const firstJump = player.grounded;
      player.velocityY = firstJump ? -690 : -610;
      player.jumpsRemaining -= 1;
      player.grounded = false;
      shakeTime = firstJump ? .08 : .13;
      shakePower = firstJump ? 2 : 4;
      emitParticles(player.x + 15, firstJump ? floor : player.y + player.height / 2, firstJump ? "#d3ff72" : "#8df7df", firstJump ? 5 : 10);
    }
  }

  function startGame() {
    state = "running";
    elapsed = 0;
    distance = 0;
    shards = 0;
    speed = 300;
    obstacleTimer = .9;
    pickupTimer = 1.6;
    obstacles.length = 0;
    pickups.length = 0;
    particles.length = 0;
    player.y = floor - player.height;
    player.velocityY = 0;
    player.grounded = true;
    player.jumpsRemaining = 2;
    player.shield = false;
    player.shieldTime = 0;
    trailTimer = 0;
    shakeTime = 0;
    pauseButton.disabled = false;
    pauseLabel.textContent = "PAUSE";
    pauseButton.setAttribute("aria-label", "Pause game");
    scoreElement.textContent = formatScore(0);
    shardsElement.textContent = "00";
    statusElement.textContent = "RUNNING";
    overlay.classList.add("is-hidden");
    shieldIndicator.hidden = true;
  }

  function pauseGame() {
    if (state !== "running") return;
    state = "paused";
    statusElement.textContent = "PAUSED";
    overlayKicker.textContent = "TAKE A BREATHER";
    overlayTitle.innerHTML = `Catch your<br><span>breath.</span>`;
    overlayCopy.textContent = "Your run is on hold. Pick up where you left off.";
    buttonLabel.textContent = "Resume running";
    overlayHint.textContent = "PRESS SPACE OR TAP TO RESUME";
    overlay.classList.remove("is-hidden");
    pauseLabel.textContent = "RESUME";
    pauseButton.setAttribute("aria-label", "Resume game");
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "running";
    statusElement.textContent = "RUNNING";
    overlay.classList.add("is-hidden");
    pauseLabel.textContent = "PAUSE";
    pauseButton.setAttribute("aria-label", "Pause game");
  }

  function endGame() {
    state = "over";
    statusElement.textContent = "WIPEOUT";
    pauseButton.disabled = true;
    pauseLabel.textContent = "PAUSE";
    pauseButton.setAttribute("aria-label", "Pause game");
    shakeTime = .3;
    shakePower = 8;
    emitParticles(player.x + player.width / 2, player.y + player.height / 2, "#ff8377", 18);
    const score = Math.floor(distance);
    if (score > best) {
      best = score;
      bestElement.textContent = formatScore(best);
      saveBest();
    }
    overlayKicker.textContent = "RUN COMPLETE // NIGHT RIDER";
    overlayTitle.innerHTML = `You made it<br><span>${formatScore(score)}m.</span>`;
    overlayCopy.textContent = `${shards} shard${shards === 1 ? "" : "s"} collected. Ready to beat that?`;
    buttonLabel.textContent = "Run it back";
    overlayHint.textContent = "PRESS SPACE OR TAP TO RUN IT BACK";
    overlay.classList.remove("is-hidden");
    shieldIndicator.hidden = true;
  }

  function intersects(a, b, padding = 0) {
    return a.x + padding < b.x + b.width &&
      a.x + a.width - padding > b.x &&
      a.y + padding < b.y + b.height &&
      a.y + a.height - padding > b.y;
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 190 * dt;
      if (particle.life <= 0) particles.splice(i, 1);
    }

    shakeTime = Math.max(0, shakeTime - dt);
    if (state !== "running") return;
    elapsed += dt;
    distance += speed * dt * .035;
    speed = Math.min(600, 300 + distance * 1.3);
    scoreElement.textContent = formatScore(distance);

    player.velocityY += gravity * dt;
    player.y += player.velocityY * dt;
    if (player.y + player.height >= floor) {
      player.y = floor - player.height;
      player.velocityY = 0;
      player.grounded = true;
      player.jumpsRemaining = 2;
    }
    if (!player.grounded) {
      trailTimer -= dt;
      if (trailTimer <= 0) {
        particles.push({
          x: player.x + 4,
          y: player.y + player.height * .68,
          vx: -45 - Math.random() * 45,
          vy: (Math.random() - .5) * 25,
          life: .16,
          maxLife: .16,
          size: 2 + Math.random() * 3,
          color: "#78dcca"
        });
        trailTimer = .035;
      }
    }
    if (player.shield) {
      player.shieldTime -= dt;
      if (player.shieldTime <= 0) {
        player.shield = false;
        shieldIndicator.hidden = true;
      }
    }

    obstacleTimer -= dt;
    if (obstacleTimer <= 0) {
      spawnObstacle();
      obstacleTimer = Math.max(.75, 1.35 - (speed - 300) / 700) + Math.random() * .48;
    }
    pickupTimer -= dt;
    if (pickupTimer <= 0) {
      spawnPickup();
      pickupTimer = 2.8 + Math.random() * 2.2;
    }

    obstacles.forEach((obstacle) => { obstacle.x -= speed * dt; });
    pickups.forEach((pickup) => { pickup.x -= speed * dt; });
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      if (obstacle.x + obstacle.width < -10) {
        obstacles.splice(i, 1);
      } else if (intersects(player, obstacle, 5)) {
        if (player.shield) {
          player.shield = false;
          shieldIndicator.hidden = true;
          obstacles.splice(i, 1);
          emitParticles(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, "#d3ff72", 14);
        } else {
          shakeTime = .3;
          shakePower = 8;
          endGame();
          break;
        }
      }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
      const pickup = pickups[i];
      if (pickup.x < -20) {
        pickups.splice(i, 1);
      } else if (intersects(player, { x: pickup.x - 12, y: pickup.y - 12, width: 24, height: 24 }, -3)) {
        if (pickup.type === "shield") {
          player.shield = true;
          player.shieldTime = 8;
          shieldIndicator.hidden = false;
        } else {
          shards += 1;
          shardsElement.textContent = String(shards).padStart(2, "0");
        }
        emitParticles(pickup.x, pickup.y, pickup.type === "shield" ? "#d3ff72" : "#ffe383", 10);
        pickups.splice(i, 1);
      }
    }

  }

  function render(dt) {
    const shake = shakeTime > 0 ? shakePower * (shakeTime / .3) : 0;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    drawBackground(dt);
    pickups.forEach(drawPickup);
    obstacles.forEach(drawObstacle);
    drawRunner();
    particles.forEach((particle) => {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function frame(time) {
    const dt = Math.min((time - lastTime) / 1000 || 0, .04);
    lastTime = time;
    update(dt);
    render(dt);
    requestAnimationFrame(frame);
  }

  playButton.addEventListener("click", jump);
  pauseButton.addEventListener("click", () => {
    if (state === "paused") resumeGame();
    else pauseGame();
  });
  mobileJump.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    jump();
  });
  canvas.addEventListener("pointerdown", () => {
    if (state === "running") jump();
  });
  document.addEventListener("keydown", (event) => {
    if (event.code === "Escape" || event.code === "KeyP") {
      event.preventDefault();
      if (state === "running") pauseGame();
      else if (state === "paused") resumeGame();
      return;
    }
    if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) jump();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseGame();
  });
  window.addEventListener("resize", resize);

  resize();
  requestAnimationFrame(frame);
})();