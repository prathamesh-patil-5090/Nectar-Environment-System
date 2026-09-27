/**
 * VideoPlayerEngine — OOP class that encapsulates all video playback state.
 *
 * Design principle: All mutable playback fields live inside this class instance
 * (held in a React ref, never stored in useState). The engine calls three thin
 * callbacks to notify React only when it needs to re-paint the UI:
 *   onTimeUpdate(sec)       — fires every tick
 *   onPlayStateChange(bool) — fires on play/pause/end
 *   onProgressCommit(sec)   — fires to persist progress (seek / tick)
 *
 * This completely eliminates setState-inside-setInterval loops.
 */
export class VideoPlayerEngine {
  private _isPlaying = false;
  private _currentSec = 0;
  private _duration = 0;
  private _speed = 1.0;
  private _maxAllowedSec = 0;
  private _timer: ReturnType<typeof setInterval> | null = null;

  private onTimeUpdate: (sec: number) => void;
  private onPlayStateChange: (playing: boolean) => void;
  private onProgressCommit: (sec: number) => void;
  private onSeekBlocked?: (maxAllowedSec: number) => void;

  constructor(opts: {
    onTimeUpdate: (sec: number) => void;
    onPlayStateChange: (playing: boolean) => void;
    onProgressCommit: (sec: number) => void;
    onSeekBlocked?: (maxAllowedSec: number) => void;
  }) {
    this.onTimeUpdate = opts.onTimeUpdate;
    this.onPlayStateChange = opts.onPlayStateChange;
    this.onProgressCommit = opts.onProgressCommit;
    this.onSeekBlocked = opts.onSeekBlocked;
  }

  // ── Configuration ────────────────────────────────────────────────
  setDuration(dur: number) {
    this._duration = dur;
  }

  setSpeed(speed: number) {
    const wasPlaying = this._isPlaying;
    if (wasPlaying) this._stopTimer();
    this._speed = speed;
    if (wasPlaying) this._startTimer();
  }

  /** Seek to an exact position (anti-skip law: cannot jump past max watched frontier) */
  seekTo(sec: number) {
    let target = Math.max(0, Math.min(this._duration, sec));
    if (target > this._maxAllowedSec + 2) {
      target = this._maxAllowedSec;
      this.onSeekBlocked?.(this._maxAllowedSec);
    }
    this._currentSec = target;
    this._maxAllowedSec = Math.max(this._maxAllowedSec, target);
    this.onTimeUpdate(target);
    this.onProgressCommit(target);
  }

  /** Visual-only scrub during drag — clamped to max allowed */
  scrubTo(sec: number) {
    let target = Math.max(0, Math.min(this._duration, sec));
    if (target > this._maxAllowedSec + 2) {
      target = this._maxAllowedSec;
      this.onSeekBlocked?.(this._maxAllowedSec);
    }
    this._currentSec = target;
    this.onTimeUpdate(target);
  }

  skip(deltaSec: number) {
    this.seekTo(this._currentSec + deltaSec);
  }

  // ── Playback control ─────────────────────────────────────────────
  play() {
    if (this._isPlaying) return;
    this._isPlaying = true;
    this.onPlayStateChange(true);
    this._startTimer();
  }

  pause() {
    if (!this._isPlaying) return;
    this._isPlaying = false;
    this.onPlayStateChange(false);
    this._stopTimer();
  }

  toggle() {
    if (this._isPlaying) this.pause();
    else this.play();
  }

  /** Switch module — resets timer and position atomically */
  switchAbility(initialSec: number, durationSec: number) {
    this._stopTimer();
    this._isPlaying = false;
    this._currentSec = initialSec;
    this._duration = durationSec;
    this._maxAllowedSec = Math.max(0, initialSec);
    this.onTimeUpdate(initialSec);
    this.onPlayStateChange(false);
  }

  /** Call in React useEffect cleanup */
  destroy() {
    this._stopTimer();
  }

  // ── Getters ──────────────────────────────────────────────────────
  get currentSec() { return this._currentSec; }
  get isPlaying() { return this._isPlaying; }
  get duration() { return this._duration; }
  get maxAllowedSec() { return this._maxAllowedSec; }

  // ── Private timer ─────────────────────────────────────────────────
  private _startTimer() {
    this._stopTimer();
    this._timer = setInterval(() => {
      if (this._currentSec >= this._duration) {
        this._stopTimer();
        this._isPlaying = false;
        this.onPlayStateChange(false);
        return;
      }
      const next = Math.min(this._duration, this._currentSec + this._speed);
      this._currentSec = next;
      this._maxAllowedSec = Math.max(this._maxAllowedSec, next);
      this.onTimeUpdate(next);
      this.onProgressCommit(next);
      if (next >= this._duration) {
        this._stopTimer();
        this._isPlaying = false;
        this.onPlayStateChange(false);
      }
    }, 1000 / this._speed);
  }

  private _stopTimer() {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}
