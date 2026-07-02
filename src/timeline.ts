import { TimelineEvent } from "./timelineEvent.js";

export class Timeline {
  events: TimelineEvent[];

  constructor() {
    this.events = [];
  }

  addEvent(event: TimelineEvent): void {
    this.events.push(event);
  }
}