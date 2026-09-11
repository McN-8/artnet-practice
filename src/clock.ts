export type ClockTimer = unknown;

export interface Clock {
  setTimeout(
    callback: () => void,
    delay: number
  ): ClockTimer;

  clearTimeout(timer: ClockTimer): void;
}

export class SystemClock implements Clock {
  setTimeout(
    callback: () => void,
    delay: number
  ): ReturnType<typeof setTimeout> {
    return setTimeout(callback, delay);
  }

  clearTimeout(timer: ClockTimer): void {
    clearTimeout(timer as ReturnType<typeof setTimeout>);
  }
}

interface ScheduledTask {
  id: number;
  dueAt: number;
  callback: () => void;
}

export class DeterministicClock implements Clock {
  private currentTime = 0;
  private nextTimerId = 1;
  private tasks = new Map<number, ScheduledTask>();

  get now(): number {
    return this.currentTime;
  }

  get pendingTimerCount(): number {
    return this.tasks.size;
  }

  setTimeout(callback: () => void, delay: number): number {
    const id = this.nextTimerId++;

    this.tasks.set(id, {
      id,
      dueAt: this.currentTime + Math.max(0, delay),
      callback
    });

    return id;
  }

  clearTimeout(timer: ClockTimer): void {
    if (typeof timer === "number") {
      this.tasks.delete(timer);
    }
  }

  advanceBy(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new RangeError(
        "Clock advancement must be a finite nonnegative number."
      );
    }

    const targetTime = this.currentTime + milliseconds;

    while (true) {
      const nextTask = [...this.tasks.values()]
        .filter((task) => task.dueAt <= targetTime)
        .sort(
          (left, right) =>
            left.dueAt - right.dueAt || left.id - right.id
        )[0];

      if (!nextTask) {
        break;
      }

      this.tasks.delete(nextTask.id);
      this.currentTime = nextTask.dueAt;
      nextTask.callback();
    }

    this.currentTime = targetTime;
  }

  runAll(): void {
    while (this.tasks.size > 0) {
      const nextDueAt = Math.min(
        ...[...this.tasks.values()].map((task) => task.dueAt)
      );

      this.advanceBy(nextDueAt - this.currentTime);
    }
  }
}
