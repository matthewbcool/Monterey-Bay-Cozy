/** Standard-mapping gamepad reader (Xbox/PlayStation/Switch Pro in browsers that report
 * `mapping: 'standard'`). Polled once per frame by its owner; no events, no allocation per frame.
 * Button indices follow the W3C standard layout: 0 A/Cross, 1 B/Circle, 2 X/Square, 3 Y/Triangle,
 * 9 Start/Options, 12–15 d-pad up/down/left/right. Sticks use a radial dead zone. */
export const PAD = { a: 0, b: 1, x: 2, y: 3, start: 9, up: 12, down: 13, left: 14, right: 15 } as const;
const BUTTONS = 16, DEAD_ZONE = .18;

export function createGamepadReader() {
  const held = new Array<boolean>(BUTTONS).fill(false), was = new Array<boolean>(BUTTONS).fill(false);
  // A cleared button stays silent until it is physically released.
  const suppressed = new Array<boolean>(BUTTONS).fill(false);
  const state = { connected: false, active: false, moveX: 0, moveY: 0, lookX: 0, lookY: 0 };
  function stick(x: number, y: number, out: 'move' | 'look') {
    const length = Math.hypot(x, y);
    // Rescale past the dead zone so small deflections still give slow, precise movement.
    const scale = length > DEAD_ZONE ? Math.min(1, (length - DEAD_ZONE) / (1 - DEAD_ZONE)) / length : 0;
    if (out === 'move') { state.moveX = x * scale; state.moveY = y * scale; } else { state.lookX = x * scale; state.lookY = y * scale; }
  }
  function poll() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const candidate of pads) if (candidate?.connected && candidate.mapping === 'standard') { pad = candidate; break; }
    for (let i = 0; i < BUTTONS; i++) was[i] = held[i];
    state.connected = !!pad; state.active = false;
    if (!pad) { held.fill(false); state.moveX = state.moveY = state.lookX = state.lookY = 0; return state; }
    for (let i = 0; i < BUTTONS; i++) {
      const down = !!pad.buttons[i]?.pressed; if (down) state.active = true;
      if (!down) suppressed[i] = false;
      held[i] = down && !suppressed[i];
    }
    stick(pad.axes[0] ?? 0, pad.axes[1] ?? 0, 'move'); stick(pad.axes[2] ?? 0, pad.axes[3] ?? 0, 'look');
    if (state.moveX || state.moveY || state.lookX || state.lookY) state.active = true;
    return state;
  }
  return {
    state, poll,
    held: (button: number) => held[button],
    pressed: (button: number) => held[button] && !was[button],
    released: (button: number) => !held[button] && was[button],
    /** Forget held buttons, e.g. when the view is hidden, so nothing fires on return. */
    clear() { for (let i = 0; i < BUTTONS; i++) { if (held[i]) suppressed[i] = true; held[i] = was[i] = false; } },
  };
}
