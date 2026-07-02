export class TimelineEvent {
  timestamp: number;
  description: string;

  constructor(
    timestamp: number,
    description: string
  ) {
    this.timestamp = timestamp;
    this.description = description;
  }
}