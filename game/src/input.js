// Keyboard, mouse and touch, reduced to a handful of actions the loop reads
// once a frame. Jump: Space, ArrowUp, W, click or tap. Slide: ArrowDown or S.
// Hide: H, only beside a haystack. Confirm / pause / mute are edges, not holds.

export const ACTION_JUMP = 1;
export const ACTION_SLIDE = 2;
export const ACTION_HIDE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_PAUSE = 16;
export const ACTION_MUTE = 32;

export function createInput(canvas) {
  let queued = 0;
  let jumpHeld = false;
  let slideHeld = false;

  function press(action) {
    queued |= action;
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    switch (event.code) {
      case 'Space':
      case 'ArrowUp':
      case 'KeyW':
        press(ACTION_JUMP);
        jumpHeld = true;
        event.preventDefault();
        break;
      case 'ArrowDown':
      case 'KeyS':
        press(ACTION_SLIDE);
        slideHeld = true;
        event.preventDefault();
        break;
      case 'KeyH':
        press(ACTION_HIDE);
        break;
      case 'Enter':
        press(ACTION_CONFIRM);
        break;
      case 'KeyP':
      case 'Escape':
        press(ACTION_PAUSE);
        break;
      case 'KeyM':
        press(ACTION_MUTE);
        break;
      default:
        break;
    }
  }

  function onKeyUp(event) {
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') jumpHeld = false;
    if (event.code === 'ArrowDown' || event.code === 'KeyS') slideHeld = false;
  }

  function onPointerDown(event) {
    // A click or tap jumps; a press in the lower half of the screen slides.
    const rect = canvas.getBoundingClientRect();
    const y = (event.clientY - rect.top) / rect.height;
    if (y > 0.62) press(ACTION_SLIDE);
    else press(ACTION_JUMP);
    event.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    /** The actions pressed since the last call, then cleared. */
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
    isJumpHeld() {
      return jumpHeld;
    },
    isSlideHeld() {
      return slideHeld;
    },
  };
}
