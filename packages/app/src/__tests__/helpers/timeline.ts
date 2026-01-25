export type TimelineEvent = {
  seq: number;
  label: string;
  meta?: Record<string, unknown>;
};

export class Timeline {
  private _events: TimelineEvent[] = [];

  mark(label: string, meta?: Record<string, unknown>): number {
    const event: TimelineEvent = {
      seq: this._events.length,
      label,
      meta,
    };
    this._events.push(event);
    return event.seq;
  }

  events(): readonly TimelineEvent[] {
    return this._events;
  }

  indexOf(label: string, predicate?: (event: TimelineEvent) => boolean): number {
    for (const event of this._events) {
      if (event.label !== label) continue;
      if (!predicate || predicate(event)) {
        return event.seq;
      }
    }
    return -1;
  }
}
