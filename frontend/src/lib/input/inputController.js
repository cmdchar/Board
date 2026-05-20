const DEFAULT_LONG_PRESS_MS = 430;
const DEFAULT_MOVE_TOLERANCE = 12;
const DEFAULT_DOUBLE_TAP_MS = 280;
const DEFAULT_DOUBLE_TAP_TOLERANCE = 28;
const DEFAULT_TWO_FINGER_SWIPE_MIN = 48;

function distance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0), (Number(a.y) || 0) - (Number(b.y) || 0));
}

export function createInputController(options = {}) {
  const config = {
    longPressMs: Math.max(180, Number(options.longPressMs) || DEFAULT_LONG_PRESS_MS),
    moveTolerance: Math.max(4, Number(options.moveTolerance) || DEFAULT_MOVE_TOLERANCE),
    doubleTapMs: Math.max(120, Number(options.doubleTapMs) || DEFAULT_DOUBLE_TAP_MS),
    doubleTapTolerance: Math.max(8, Number(options.doubleTapTolerance) || DEFAULT_DOUBLE_TAP_TOLERANCE),
    twoFingerSwipeMin: Math.max(24, Number(options.twoFingerSwipeMin) || DEFAULT_TWO_FINGER_SWIPE_MIN),
  };

  let onLongPress = typeof options.onLongPress === "function" ? options.onLongPress : null;

  const state = {
    press: null,
    timer: null,
    lastTap: null,
    twoFinger: null,
  };

  const clearTimer = () => {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  };

  const cancelPress = () => {
    clearTimer();
    state.press = null;
  };

  const beginPress = meta => {
    cancelPress();
    if (!meta || !Number.isFinite(meta.x) || !Number.isFinite(meta.y)) return;

    state.press = {
      x: meta.x,
      y: meta.y,
      start: { x: meta.x, y: meta.y },
      last: { x: meta.x, y: meta.y },
      targetType: String(meta.targetType || "canvas"),
      targetNodeId: String(meta.targetNodeId || ""),
      moved: false,
      longPressTriggered: false,
      payload: meta.payload || null,
    };

    state.timer = setTimeout(() => {
      state.timer = null;
      if (!state.press) return;
      state.press.longPressTriggered = true;
      if (typeof onLongPress === "function") {
        onLongPress({
          x: state.press.x,
          y: state.press.y,
          targetType: state.press.targetType,
          targetNodeId: state.press.targetNodeId,
          payload: state.press.payload,
        });
      }
    }, config.longPressMs);
  };

  const movePress = point => {
    if (!state.press || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;

    state.press.last = { x: point.x, y: point.y };
    const movedDist = distance(state.press.start, state.press.last);
    if (movedDist > config.moveTolerance) {
      state.press.moved = true;
      clearTimer();
    }
  };

  const endPress = () => {
    const didLongPress = Boolean(state.press?.longPressTriggered);
    cancelPress();
    return didLongPress;
  };

  const registerTap = meta => {
    if (!meta || !Number.isFinite(meta.x) || !Number.isFinite(meta.y)) return { doubleTap: false };
    const now = Date.now();
    const targetType = String(meta.targetType || "canvas");
    const targetNodeId = String(meta.targetNodeId || "");
    const hit = state.lastTap;
    const next = { x: meta.x, y: meta.y, at: now, targetType, targetNodeId };
    state.lastTap = next;
    if (!hit) return { doubleTap: false };
    if (now - hit.at > config.doubleTapMs) return { doubleTap: false };
    if (hit.targetType !== targetType) return { doubleTap: false };
    if (hit.targetNodeId !== targetNodeId) return { doubleTap: false };
    const dist = distance(hit, next);
    if (dist > config.doubleTapTolerance) return { doubleTap: false };
    state.lastTap = null;
    return { doubleTap: true, targetType, targetNodeId };
  };

  const centerOf = points => {
    if (!Array.isArray(points) || points.length < 2) return null;
    const [a, b] = points;
    if (!a || !b) return null;
    return { x: (Number(a.x) + Number(b.x)) * 0.5, y: (Number(a.y) + Number(b.y)) * 0.5 };
  };

  const distOf = points => {
    if (!Array.isArray(points) || points.length < 2) return 0;
    const [a, b] = points;
    if (!a || !b) return 0;
    return Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0), (Number(a.y) || 0) - (Number(b.y) || 0));
  };

  const beginTwoFinger = points => {
    const center = centerOf(points);
    if (!center) return;
    state.twoFinger = {
      startCenter: center,
      lastCenter: center,
      startDist: distOf(points),
      lastDist: distOf(points),
      moved: false,
    };
  };

  const updateTwoFinger = points => {
    if (!state.twoFinger) return;
    const center = centerOf(points);
    if (!center) return;
    state.twoFinger.lastCenter = center;
    state.twoFinger.lastDist = distOf(points);
    if (distance(state.twoFinger.startCenter, center) > config.moveTolerance) {
      state.twoFinger.moved = true;
    }
  };

  const endTwoFinger = points => {
    if (!state.twoFinger) return null;
    const endCenter = centerOf(points) || state.twoFinger.lastCenter || state.twoFinger.startCenter;
    const endDist = distOf(points) || state.twoFinger.lastDist || state.twoFinger.startDist;
    const start = state.twoFinger.startCenter;
    const dx = (endCenter?.x || 0) - (start?.x || 0);
    const dy = (endCenter?.y || 0) - (start?.y || 0);
    const pinchDelta = Math.abs((endDist || 0) - (state.twoFinger.startDist || 0));
    state.twoFinger = null;
    if (pinchDelta > 26) return null;
    if (Math.abs(dy) < config.twoFingerSwipeMin) return null;
    if (Math.abs(dy) < Math.abs(dx) * 1.1) return null;
    return { direction: dy > 0 ? "down" : "up", dx, dy };
  };

  return {
    setLongPressHandler(fn) {
      onLongPress = typeof fn === "function" ? fn : null;
    },
    beginPress,
    movePress,
    endPress,
    cancelPress,
    registerTap,
    beginTwoFinger,
    updateTwoFinger,
    endTwoFinger,
    getState() {
      return state.press ? { ...state.press } : null;
    },
  };
}
