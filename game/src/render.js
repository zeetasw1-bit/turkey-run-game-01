// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. All art is flat canvas shapes in one autumn
// palette: a turkey, a farmer, the farm, the barn and the kitchen. Text that
// holds a number is rebuilt only when the number changes.
import { ESCAPE_DISTANCE, FIELD, FONT, LIVES, PALETTE, STAGES, TURKEY } from './config.js';
import {
  KIND_CRATE,
  KIND_FENCE,
  KIND_HAY,
  KIND_HAYSTACK,
  KIND_KNIFE_FALL,
  KIND_KNIFE_FLY,
  KIND_MUD,
  KIND_OVEN,
  KIND_PITCHFORK,
  PICKUP_CORN,
  PICKUP_FEATHER,
  PICKUP_PIE,
} from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const distanceLabel = cachedLabel('');
  const bestLabel = cachedLabel('BEST ');
  const stageLabel = cachedLabel('');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function text(value, x, y, size, color, align, weight) {
    const key = size + (weight || '');
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function ellipse(x, y, rx, ry, color) {
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  }

  function rect(x, y, w, h, color) {
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
  }

  function circle(x, y, r, color) {
    ellipse(x, y, r, r, color);
  }

  // --- The turkey, drawn at its top-left (x, y) with its height. ---
  function drawTurkey(x, y, height, phase, sliding, hidden) {
    if (hidden) return;
    const ground = FIELD.groundY;
    const scale = height / TURKEY.height;
    const cx = x + TURKEY.width / 2;
    const bodyY = sliding ? ground - 26 * scale : ground - 44 * scale;
    const legSwing = sliding ? 0 : Math.sin(phase) * 10;

    context.save();
    context.translate(cx, bodyY);
    context.scale(scale, scale);
    if (sliding) {
      // Low and stretched, beak first.
      ellipse(6, 2, 34, 18, PALETTE.turkeyBody);
      ellipse(28, -4, 12, 10, PALETTE.turkeyHead);
      circle(38, -6, 3, '#1d1410');
      ellipse(-30, 4, 16, 7, PALETTE.tail[1]);
      ellipse(-26, -6, 16, 7, PALETTE.tail[2]);
    } else {
      // Fanned tail behind the body.
      for (let i = 0; i < 5; i += 1) {
        const angle = -Math.PI / 2 + (i - 2) * 0.42;
        context.save();
        context.rotate(angle);
        ellipse(0, -46, 9, 30, PALETTE.tail[i]);
        context.restore();
      }
      // Body, belly, wing.
      ellipse(0, 0, 30, 34, PALETTE.turkeyBody);
      ellipse(4, 8, 20, 22, PALETTE.turkeyBelly);
      ellipse(-4, -2, 16, 20, '#6b3f20');
      // Head, beak, wattle, eye.
      circle(16, -38, 13, PALETTE.turkeyHead);
      ellipse(30, -36, 10, 5, PALETTE.beak);
      ellipse(24, -28, 4, 8, PALETTE.wattle);
      circle(20, -42, 2.5, '#1d1410');
      // Legs, running.
      context.strokeStyle = '#e8a33c';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(-6, 30);
      context.lineTo(-6 + legSwing, 44);
      context.moveTo(8, 30);
      context.lineTo(8 - legSwing, 44);
      context.stroke();
    }
    context.restore();
    void y;
  }

  // --- The farmer, chasing from the left. pursuit 0..1 sets how close he is. ---
  function drawFarmer(state) {
    const p = state.pursuit;
    // He never leaves the frame entirely: far behind, he is a small figure at
    // the left edge; close behind, he looms right at the turkey's tail.
    const x = Math.max(24, TURKEY.x - 300 + p * 300);
    if (x < -90) return;
    const ground = FIELD.groundY;
    const bob = Math.abs(Math.sin(state.time * 11)) * 6;
    const angry = state.spotted;

    context.save();
    context.translate(x, ground - bob);
    // Legs.
    context.strokeStyle = PALETTE.farmerOveralls;
    context.lineWidth = 9;
    const swing = Math.sin(state.time * 11) * 12;
    context.beginPath();
    context.moveTo(-4, -34);
    context.lineTo(-4 + swing, 0);
    context.moveTo(6, -34);
    context.lineTo(6 - swing, 0);
    context.stroke();
    // Body: shirt and overalls.
    rect(-16, -72, 34, 40, PALETTE.farmerShirt);
    rect(-14, -52, 30, 22, PALETTE.farmerOveralls);
    // Head and straw hat.
    circle(2, -84, 14, PALETTE.farmerSkin);
    ellipse(2, -94, 22, 6, PALETTE.farmerHat);
    ellipse(2, -98, 12, 8, PALETTE.farmerHat);
    // Angry brows, or a dozy look when far behind.
    context.strokeStyle = '#3a2415';
    context.lineWidth = 2.5;
    context.beginPath();
    if (angry) {
      context.moveTo(-8, -90);
      context.lineTo(-1, -87);
      context.moveTo(12, -90);
      context.lineTo(5, -87);
    } else {
      context.moveTo(-8, -89);
      context.lineTo(-1, -89);
      context.moveTo(5, -89);
      context.lineTo(12, -89);
    }
    context.stroke();
    circle(-4, -84, 2, '#1d1410');
    circle(8, -84, 2, '#1d1410');
    // Pitchfork, raised and ready.
    context.strokeStyle = '#8a6b3f';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(20, -60);
    context.lineTo(34, -108);
    context.stroke();
    context.strokeStyle = '#c9ced6';
    context.lineWidth = 2.5;
    for (let i = -1; i <= 1; i += 1) {
      context.beginPath();
      context.moveTo(34 + i * 5, -108);
      context.lineTo(34 + i * 7, -122);
      context.stroke();
    }
    context.restore();

    if (state.spotted) {
      text('!', x + 24, ground - 128, 34, '#ff5a3c', 'center', 'bold');
    }
  }

  function drawCloud(x, y, scale, color) {
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(x, y, 46 * scale, 18 * scale, 0, 0, Math.PI * 2);
    context.ellipse(x + 28 * scale, y + 4 * scale, 34 * scale, 14 * scale, 0, 0, Math.PI * 2);
    context.ellipse(x - 28 * scale, y + 5 * scale, 30 * scale, 12 * scale, 0, 0, Math.PI * 2);
    context.fill();
  }

  function drawBackground(state) {
    const stage = STAGES[state.stage];
    const sky = context.createLinearGradient(0, 0, 0, FIELD.groundY);
    sky.addColorStop(0, stage.sky[0]);
    sky.addColorStop(1, stage.sky[1]);
    context.fillStyle = sky;
    context.fillRect(0, 0, FIELD.width, FIELD.groundY);

    // Low autumn sun and drifting clouds.
    circle(1080, 110, 44, '#ffe9a8');
    circle(1080, 110, 58, 'rgba(255, 233, 168, 0.25)');
    const drift = (state.time * 12) % 1400;
    drawCloud(300 - drift, 90, 1, 'rgba(255, 243, 214, 0.75)');
    drawCloud(900 - drift, 150, 0.8, 'rgba(255, 243, 214, 0.6)');
    drawCloud(1500 - drift, 70, 1.1, 'rgba(255, 243, 214, 0.5)');

    // Distant silhouettes, one per stage.
    context.fillStyle = 'rgba(90, 50, 25, 0.35)';
    if (state.stage === 0) {
      rect(60, 470, 120, 150, 'rgba(90, 50, 25, 0.35)');
      context.beginPath();
      context.moveTo(50, 470);
      context.lineTo(120, 420);
      context.lineTo(190, 470);
      context.fill();
      rect(980, 500, 200, 120, 'rgba(90, 50, 25, 0.3)');
    } else if (state.stage === 1) {
      rect(0, 380, 1280, 240, 'rgba(70, 38, 20, 0.4)');
      for (let i = 0; i < 6; i += 1) rect(140 + i * 190, 400, 60, 220, 'rgba(70, 38, 20, 0.35)');
    } else {
      rect(0, 420, 1280, 200, 'rgba(60, 30, 25, 0.45)');
      for (let i = 0; i < 4; i += 1) {
        rect(180 + i * 300, 440, 120, 60, 'rgba(60, 30, 25, 0.4)');
        circle(240 + i * 300, 440, 34, 'rgba(60, 30, 25, 0.4)');
      }
    }

    // Ground with a grass strip and fence posts scrolling by.
    rect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY, stage.ground);
    rect(0, FIELD.groundY, FIELD.width, 10, stage.grass);
    const scroll = (state.distance * 40) % 160;
    context.fillStyle = 'rgba(60, 40, 20, 0.55)';
    for (let x = -scroll; x < FIELD.width; x += 160) {
      context.fillRect(x, FIELD.groundY - 34, 8, 44);
      context.fillRect(x + 8, FIELD.groundY - 30, 152, 5);
      context.fillRect(x + 8, FIELD.groundY - 16, 152, 5);
    }
  }

  function drawHay(hazard) {
    ellipse(hazard.x + hazard.width / 2, hazard.y + hazard.height - 8, hazard.width / 2, 22, '#d9a441');
    ellipse(hazard.x + hazard.width / 2, hazard.y + hazard.height - 26, hazard.width / 2 - 8, 20, '#e8c96a');
    context.strokeStyle = '#a87c2a';
    context.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      context.beginPath();
      context.moveTo(hazard.x + 16 + i * 28, hazard.y + 12);
      context.lineTo(hazard.x + 16 + i * 28, hazard.y + hazard.height - 10);
      context.stroke();
    }
  }

  function drawHaystack(hazard) {
    ellipse(hazard.x + hazard.width / 2, hazard.y + hazard.height - 6, hazard.width / 2, 40, '#c9973a');
    ellipse(hazard.x + hazard.width / 2, hazard.y + 34, hazard.width / 2 - 14, 34, '#e0b95c');
    context.strokeStyle = '#a87c2a';
    context.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      context.beginPath();
      context.moveTo(hazard.x + 18 + i * 24, hazard.y + 18);
      context.quadraticCurveTo(hazard.x + 24 + i * 24, hazard.y + 44, hazard.x + 18 + i * 24, hazard.y + hazard.height - 8);
      context.stroke();
    }
    text('HIDE [H]', hazard.x + hazard.width / 2, hazard.y - 10, 15, PALETTE.text, 'center', 'bold');
  }

  function drawFence(hazard) {
    context.fillStyle = '#8a6b3f';
    context.fillRect(hazard.x, hazard.y, 8, hazard.height);
    context.fillRect(hazard.x + hazard.width - 8, hazard.y, 8, hazard.height);
    context.fillRect(hazard.x, hazard.y + 10, hazard.width, 8);
    context.fillRect(hazard.x, hazard.y + 34, hazard.width, 8);
  }

  function drawMud(hazard) {
    ellipse(hazard.x + hazard.width / 2, hazard.y + 7, hazard.width / 2, 9, '#5a3d24');
    ellipse(hazard.x + hazard.width / 2 - 20, hazard.y + 5, 26, 6, '#6e4a2f');
    text('MUD!', hazard.x + hazard.width / 2, hazard.y - 8, 13, '#d9b98a', 'center', 'bold');
  }

  function drawCrate(hazard) {
    rect(hazard.x, hazard.y, hazard.width, hazard.height, '#a9713f');
    context.strokeStyle = '#6e4a2f';
    context.lineWidth = 3;
    context.strokeRect(hazard.x + 2, hazard.y + 2, hazard.width - 4, hazard.height - 4);
    context.beginPath();
    context.moveTo(hazard.x, hazard.y);
    context.lineTo(hazard.x + hazard.width, hazard.y + hazard.height);
    context.moveTo(hazard.x + hazard.width, hazard.y);
    context.lineTo(hazard.x, hazard.y + hazard.height);
    context.stroke();
  }

  function drawPitchfork(hazard) {
    context.strokeStyle = '#8a6b3f';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(hazard.x + hazard.width / 2, hazard.y + hazard.height);
    context.lineTo(hazard.x + hazard.width / 2, hazard.y + 16);
    context.stroke();
    context.strokeStyle = PALETTE.knifeBlade;
    context.lineWidth = 3;
    for (let i = -1; i <= 1; i += 1) {
      context.beginPath();
      context.moveTo(hazard.x + hazard.width / 2 + i * 8, hazard.y + 16);
      context.lineTo(hazard.x + hazard.width / 2 + i * 11, hazard.y);
      context.stroke();
    }
  }

  function drawOven(hazard) {
    rect(hazard.x, hazard.y, hazard.width, hazard.height, PALETTE.ovenBody);
    rect(hazard.x + 8, hazard.y + 8, hazard.width - 16, hazard.height - 16, '#2e2e34');
    // The glow of the hot oven, and the turkey-shaped roast it must never hold.
    const flicker = 0.7 + Math.sin(Date.now() / 90) * 0.3;
    context.fillStyle = `rgba(255, 154, 60, ${0.55 * flicker})`;
    context.fillRect(hazard.x + 16, hazard.y + 16, hazard.width - 32, hazard.height - 32);
    context.fillStyle = '#ffd94d';
    context.beginPath();
    context.moveTo(hazard.x + hazard.width / 2 - 18, hazard.y + hazard.height - 20);
    context.quadraticCurveTo(hazard.x + hazard.width / 2, hazard.y + 22, hazard.x + hazard.width / 2 + 18, hazard.y + hazard.height - 20);
    context.fill();
    text('OVEN', hazard.x + hazard.width / 2, hazard.y - 10, 15, '#ffb37a', 'center', 'bold');
  }

  function drawKnife(hazard, falling) {
    if (falling && !hazard.landed) {
      // Landing marker, so the fall is always fair.
      context.strokeStyle = 'rgba(255, 90, 60, 0.9)';
      context.lineWidth = 3;
      const cx = hazard.x + hazard.width / 2;
      context.beginPath();
      context.moveTo(cx - 14, FIELD.groundY - 4);
      context.lineTo(cx + 14, FIELD.groundY - 4);
      context.moveTo(cx, FIELD.groundY - 18);
      context.lineTo(cx, FIELD.groundY + 2);
      context.stroke();
      text('!', cx, hazard.y - 12, 26, '#ff5a3c', 'center', 'bold');
    }
    const horizontal = hazard.kind === KIND_KNIFE_FLY;
    context.save();
    context.translate(hazard.x + hazard.width / 2, hazard.y + hazard.height / 2);
    if (horizontal) context.rotate(Math.PI / 2);
    else if (!hazard.landed) context.rotate(0.12);
    // Blade, point down.
    context.fillStyle = PALETTE.knifeBlade;
    context.beginPath();
    context.moveTo(-9, -hazard.height / 2 + 14);
    context.lineTo(9, -hazard.height / 2 + 14);
    context.lineTo(0, hazard.height / 2);
    context.closePath();
    context.fill();
    // Handle.
    rect(-7, -hazard.height / 2, 14, 16, PALETTE.knifeHandle);
    context.restore();
  }

  function drawHazard(hazard) {
    switch (hazard.kind) {
      case KIND_HAY: drawHay(hazard); break;
      case KIND_HAYSTACK: drawHaystack(hazard); break;
      case KIND_FENCE: drawFence(hazard); break;
      case KIND_MUD: drawMud(hazard); break;
      case KIND_CRATE: drawCrate(hazard); break;
      case KIND_PITCHFORK: drawPitchfork(hazard); break;
      case KIND_OVEN: drawOven(hazard); break;
      case KIND_KNIFE_FALL: drawKnife(hazard, true); break;
      case KIND_KNIFE_FLY: drawKnife(hazard, false); break;
      default: break;
    }
  }

  function drawPickup(pickup) {
    const bob = Math.sin((pickup.x + stateTime()) * 0.05) * 3;
    if (pickup.kind === PICKUP_CORN) {
      ellipse(pickup.x + 15, pickup.y + 15 + bob, 13, 8, PALETTE.corn);
      context.strokeStyle = '#a87c2a';
      context.lineWidth = 1.5;
      for (let i = -1; i <= 1; i += 1) {
        context.beginPath();
        context.moveTo(pickup.x + 15 + i * 6, pickup.y + 8 + bob);
        context.lineTo(pickup.x + 15 + i * 6, pickup.y + 22 + bob);
        context.stroke();
      }
      ellipse(pickup.x + 28, pickup.y + 6 + bob, 5, 9, '#7da05c');
    } else if (pickup.kind === PICKUP_FEATHER) {
      context.save();
      context.translate(pickup.x + 15, pickup.y + 15 + bob);
      context.rotate(-0.5);
      ellipse(0, 0, 8, 18, PALETTE.feather);
      context.strokeStyle = '#a87c2a';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -16);
      context.lineTo(0, 16);
      context.stroke();
      context.restore();
      text('+50', pickup.x + 15, pickup.y - 8 + bob, 13, PALETTE.feather, 'center', 'bold');
    } else if (pickup.kind === PICKUP_PIE) {
      ellipse(pickup.x + 15, pickup.y + 16 + bob, 14, 10, '#c96a2e');
      ellipse(pickup.x + 15, pickup.y + 12 + bob, 14, 5, '#e5534b');
      text('+1 LIFE', pickup.x + 15, pickup.y - 8 + bob, 12, '#ff8a7a', 'center', 'bold');
    }
    function stateTime() {
      return performance.now() / 100;
    }
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawHearts(state) {
    for (let i = 0; i < LIVES; i += 1) {
      const x = 24 + i * 34;
      const y = 30;
      const filled = i < state.lives;
      context.fillStyle = filled ? PALETTE.heart : PALETTE.heartEmpty;
      context.beginPath();
      context.moveTo(x, y + 8);
      context.bezierCurveTo(x - 12, y - 4, x - 6, y - 12, x, y - 4);
      context.bezierCurveTo(x + 6, y - 12, x + 12, y - 4, x, y + 8);
      context.fill();
    }
  }

  function drawHud(state, best, muted) {
    // Top bar.
    context.fillStyle = 'rgba(20, 12, 6, 0.55)';
    context.fillRect(0, 0, FIELD.width, 64);
    drawHearts(state);
    text(scoreLabel(state.score), 140, 40, 26, PALETTE.text, 'left', 'bold');
    text(distanceLabel(`${Math.floor(state.distance)}m / ${ESCAPE_DISTANCE}m`), 340, 40, 22, PALETTE.text, 'left');
    text(stageLabel(STAGES[state.stage].name), 640, 40, 22, PALETTE.text, 'center', 'bold');
    text(bestLabel(best), 1260, 40, 20, PALETTE.muted, 'right');

    // Farmer pursuit meter: how close the farmer is.
    const meterX = 980;
    const meterY = 76;
    const meterW = 260;
    context.fillStyle = 'rgba(20, 12, 6, 0.6)';
    context.fillRect(meterX - 8, meterY - 8, meterW + 16, 30);
    context.fillStyle = '#3a2a18';
    context.fillRect(meterX, meterY, meterW, 14);
    const danger = state.pursuit > 0.7;
    context.fillStyle = danger ? '#ff5a3c' : state.pursuit > 0.45 ? '#f2a93b' : '#7da05c';
    context.fillRect(meterX, meterY, meterW * state.pursuit, 14);
    text('FARMER', meterX, meterY - 2, 12, PALETTE.text, 'left', 'bold');
    text(danger ? 'RUN!' : 'ESCAPING', meterX + meterW, meterY - 2, 12, danger ? '#ff8a7a' : PALETTE.muted, 'right', 'bold');

    if (muted) text('MUTED [M]', 24, 700, 15, PALETTE.muted, 'left');

    // Stage banner on a stage change.
    if (state.stageBanner > 0) {
      context.globalAlpha = Math.min(1, state.stageBanner);
      text(STAGES[state.stage].name, FIELD.width / 2, 200, 52, PALETTE.text, 'center', 'bold');
      text('Keep running!', FIELD.width / 2, 240, 22, PALETTE.muted, 'center');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(lines, prompt) {
    const width = 640;
    const height = 120 + lines.length * 36;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    let lineY = y + 64;
    for (const line of lines) {
      text(line.text, FIELD.width / 2, lineY, line.size, line.color, 'center', line.bold ? 'bold' : '');
      lineY += 36;
    }
    text(prompt, FIELD.width / 2, y + height - 26, 20, PALETTE.muted, 'center');
  }

  function drawTitle(state, best) {
    drawBackground({ ...state, stage: 0, distance: 0 });
    // A big hero turkey at the side, mid-gobble, clear of the centred text.
    drawTurkey(170, 0, 150, state.time * 2, false, false);
    text('GOBBLE RUN', FIELD.width / 2, 150, 84, PALETTE.text, 'center', 'bold');
    text('The Great Thanksgiving Escape', FIELD.width / 2, 196, 28, '#5a2d0c', 'center', 'bold');
    // A dark band behind the instructions, so pale text reads on the bright sky.
    context.fillStyle = 'rgba(30, 18, 6, 0.45)';
    context.fillRect(0, 458, FIELD.width, 104);
    text('The farmer wants you for dinner. Run 1000m to the forest gate.', FIELD.width / 2, 484, 22, PALETTE.text, 'center');
    text('SPACE / CLICK — jump (twice = double jump)      DOWN / S — slide under knives      H — hide in a haystack', FIELD.width / 2, 518, 19, PALETTE.text, 'center');
    text('Corn distracts the farmer. Golden feathers slow him right down. P — pause, M — mute.', FIELD.width / 2, 548, 19, PALETTE.text, 'center');
    text('Press SPACE or click to run!', FIELD.width / 2, 606, 26, '#ffe9a8', 'center', 'bold');
    if (best > 0) text(bestLabel(best), FIELD.width / 2, 648, 20, PALETTE.muted, 'center');
  }

  function drawOver(state, best) {
    drawBackground(state);
    const escaped = state.outcome === 'escaped';
    if (escaped) {
      drawTurkey(170, 0, 170, state.time * 2, false, false);
      drawPanel(
        [
          { text: 'ESCAPED!', size: 56, color: '#8fd07a', bold: true },
          { text: 'You made it to the forest. No dinner tonight!', size: 22, color: PALETTE.text },
          { text: `Score ${state.score}   •   Best ${best}`, size: 22, color: PALETTE.muted },
        ],
        'Press SPACE or click to run again',
      );
    } else {
      drawPanel(
        [
          { text: 'CAUGHT!', size: 56, color: '#ff5a3c', bold: true },
          { text: 'The farmer got you... served with cranberry sauce.', size: 22, color: PALETTE.text },
          { text: `You ran ${Math.floor(state.distance)}m   •   Score ${state.score}   •   Best ${best}`, size: 22, color: PALETTE.muted },
        ],
        'Press SPACE or click to run again',
      );
    }
  }

  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 24 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 18 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);

    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    if (screen === SCREEN_OVER) {
      drawOver(state, best);
      return;
    }

    drawBackground(state);
    for (const pickup of state.pickups) drawPickup(pickup);
    // Haystacks first (the turkey hides behind them), then the rest.
    for (const hazard of state.hazards) {
      if (hazard.kind === KIND_HAYSTACK) drawHazard(hazard);
    }
    drawFarmer(state);
    const p = state.player;
    const hidden = p.hiding > 0;
    const flicker = p.invulnerable > 0 && Math.floor(state.time * 12) % 2 === 0;
    if (!flicker) {
      drawTurkey(p.x, p.y, p.sliding > 0 ? TURKEY.slideHeight : TURKEY.height, p.runPhase, p.sliding > 0, hidden);
    }
    for (const hazard of state.hazards) {
      if (hazard.kind !== KIND_HAYSTACK) drawHazard(hazard);
    }
    drawParticles(state);
    drawHud(state, best, muted);

    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(20, 12, 6, 0.6)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      drawPanel(
        [{ text: 'PAUSED', size: 48, color: PALETTE.text, bold: true }],
        'Press P or SPACE to keep running',
      );
    }
  }

  return { draw };
}
