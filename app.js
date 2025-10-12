const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const countInput = document.getElementById("count");
const gravityInput = document.getElementById("gravity");
const dampingInput = document.getElementById("damping");
const modeSelect = document.getElementById("mode");
const restartBtn = document.getElementById("restart");
const burstBtn = document.getElementById("burst");

const countVal = document.getElementById("countVal");
const gravityVal = document.getElementById("gravityVal");
const dampingVal = document.getElementById("dampingVal");

const frameMsText = document.getElementById("frameMs");
const opsText = document.getElementById("ops");
const speedText = document.getElementById("speed");
const energyText = document.getElementById("energy");

const W = canvas.width;
const H = canvas.height;
const CENTER = { x: W / 2, y: H / 2 };

let particles = [];
let lastTs = 0;
let frameMsSmooth = 0;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function resetParticles() {
  const n = Number(countInput.value);
  particles = [];
  for (let i = 0; i < n; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(30, Math.min(W, H) * 0.45);
    const x = CENTER.x + Math.cos(angle) * radius;
    const y = CENTER.y + Math.sin(angle) * radius;
    const speed = 0.5 + 18 / (radius + 20);
    const tangent = angle + Math.PI / 2;

    particles.push({
      x,
      y,
      vx: Math.cos(tangent) * speed + rand(-0.2, 0.2),
      vy: Math.sin(tangent) * speed + rand(-0.2, 0.2),
      m: rand(0.7, 2.2),
    });
  }
}

function applyBurst() {
  particles.forEach((p) => {
    const dx = p.x - CENTER.x;
    const dy = p.y - CENTER.y;
    const d = Math.hypot(dx, dy) + 1e-6;
    const force = 0.5 + 120 / (d + 80);
    p.vx += (dx / d) * force * rand(0.7, 1.2);
    p.vy += (dy / d) * force * rand(0.7, 1.2);
  });
}

function stepNaive(gravity, damping, dt) {
  let interactions = 0;
  for (let i = 0; i < particles.length; i += 1) {
    let ax = 0;
    let ay = 0;
    for (let j = 0; j < particles.length; j += 1) {
      if (i === j) continue;
      const a = particles[i];
      const b = particles[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const r2 = dx * dx + dy * dy + 18;
      const inv = 1 / Math.sqrt(r2);
      const f = gravity * b.m * inv * inv;
      ax += dx * inv * f;
      ay += dy * inv * f;
      interactions += 1;
    }
    particles[i].vx = (particles[i].vx + ax * dt) * damping;
    particles[i].vy = (particles[i].vy + ay * dt) * damping;
  }
  return interactions;
}

function stepGrid(gravity, damping, dt) {
  const cellSize = 70;
  const grid = new Map();

  for (const p of particles) {
    const cx = Math.floor(p.x / cellSize);
    const cy = Math.floor(p.y / cellSize);
    const key = `${cx},${cy}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(p);
  }

  let interactions = 0;

  for (const p of particles) {
    let ax = 0;
    let ay = 0;
    const cx = Math.floor(p.x / cellSize);
    const cy = Math.floor(p.y / cellSize);

    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        const key = `${cx + ox},${cy + oy}`;
        const bucket = grid.get(key);
        if (!bucket) continue;

        for (const q of bucket) {
          if (q === p) continue;
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const r2 = dx * dx + dy * dy + 18;
          const inv = 1 / Math.sqrt(r2);
          const f = gravity * q.m * inv * inv;
          ax += dx * inv * f;
          ay += dy * inv * f;
          interactions += 1;
        }
      }
    }

    p.vx = (p.vx + ax * dt) * damping;
    p.vy = (p.vy + ay * dt) * damping;
  }

  return interactions;
}

function integrate(dt) {
  for (const p of particles) {
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;

    if (p.x < 0 || p.x > W) p.vx *= -0.95;
    if (p.y < 0 || p.y > H) p.vy *= -0.95;

    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);

  const grad = ctx.createRadialGradient(CENTER.x, CENTER.y, 30, CENTER.x, CENTER.y, 380);
  grad.addColorStop(0, "rgba(133,182,255,0.2)");
  grad.addColorStop(1, "rgba(6,10,20,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  particles.forEach((p) => {
    const speed = Math.hypot(p.vx, p.vy);
    const radius = 1.2 + p.m * 1.6;
    const alpha = Math.min(1, 0.25 + speed * 0.1);

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(157, 202, 255, ${alpha})`;
    ctx.fill();
  });
}

function updateMetrics(interactions) {
  let speedSum = 0;
  let energy = 0;

  particles.forEach((p) => {
    const v2 = p.vx * p.vx + p.vy * p.vy;
    speedSum += Math.sqrt(v2);
    energy += 0.5 * p.m * v2;
  });

  const avgSpeed = particles.length ? speedSum / particles.length : 0;
  frameMsText.textContent = `${frameMsSmooth.toFixed(2)} ms`;
  opsText.textContent = interactions.toLocaleString();
  speedText.textContent = avgSpeed.toFixed(3);
  energyText.textContent = energy.toFixed(1);
}

function tick(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.03, (ts - lastTs) / 1000);
  lastTs = ts;

  const gravity = Number(gravityInput.value);
  const damping = Number(dampingInput.value);
  const mode = modeSelect.value;

  const t0 = performance.now();
  const interactions = mode === "naive" ? stepNaive(gravity, damping, dt) : stepGrid(gravity, damping, dt);
  integrate(dt);
  render();
  const elapsed = performance.now() - t0;

  frameMsSmooth = frameMsSmooth * 0.9 + elapsed * 0.1;
  updateMetrics(interactions);

  requestAnimationFrame(tick);
}

function syncLabels() {
  countVal.textContent = countInput.value;
  gravityVal.textContent = Number(gravityInput.value).toFixed(2);
  dampingVal.textContent = Number(dampingInput.value).toFixed(3);
}

[countInput, gravityInput, dampingInput].forEach((el) => {
  el.addEventListener("input", syncLabels);
});

restartBtn.addEventListener("click", resetParticles);
burstBtn.addEventListener("click", applyBurst);

syncLabels();
resetParticles();
requestAnimationFrame(tick);
