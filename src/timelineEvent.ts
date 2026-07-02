export class TimelineEvent {
  timestamp: number;
  type: string;
  payload: unknown;

  constructor(
    timestamp: number,
    type: string,
    payload: unknown
  ) {
    this.timestamp = timestamp;
    this.type = type;
    this.payload = payload;
  }
}