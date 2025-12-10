import { describe, it, expect, beforeEach } from 'vitest';
import type { DomainEvent } from '@manifesto-ai/core';
import {
  projectEvent,
  defaultEventTransformer,
  createToastEvent,
  createSuccessToast,
  createErrorToast,
  createWarningToast,
  createInfoToast,
  filterPendingEvents,
  dismissEvent,
  dismissAllEvents,
  getEventsBySeverity,
  getEventsByChannel,
  generateEventId,
  resetEventIdCounter,
  inferSeverity,
} from '../../src/projection/event-projection.js';
import type { UIEvent } from '../../src/types.js';

describe('event-projection', () => {
  beforeEach(() => {
    resetEventIdCounter();
  });

  describe('generateEventId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^ui-event-\d+-\d+$/);
    });
  });

  describe('inferSeverity', () => {
    it('should return explicit severity when valid', () => {
      expect(inferSeverity('success')).toBe('success');
      expect(inferSeverity('info')).toBe('info');
      expect(inferSeverity('warning')).toBe('warning');
      expect(inferSeverity('error')).toBe('error');
    });

    it('should infer error from type string', () => {
      expect(inferSeverity(undefined, 'error_occurred')).toBe('error');
      expect(inferSeverity(undefined, 'FAILED')).toBe('error');
    });

    it('should infer warning from type string', () => {
      expect(inferSeverity(undefined, 'warning_issued')).toBe('warning');
      expect(inferSeverity(undefined, 'WARN')).toBe('warning');
    });

    it('should infer success from type string', () => {
      expect(inferSeverity(undefined, 'success_result')).toBe('success');
      expect(inferSeverity(undefined, 'COMPLETED')).toBe('success');
    });

    it('should default to info', () => {
      expect(inferSeverity()).toBe('info');
      expect(inferSeverity(undefined, 'something')).toBe('info');
      expect(inferSeverity('invalid')).toBe('info');
    });
  });

  describe('defaultEventTransformer', () => {
    it('should transform domain event with message', () => {
      const domainEvent: DomainEvent = {
        channel: 'ui',
        payload: { message: 'Hello World', severity: 'success' },
        timestamp: Date.now(),
      };

      const uiEvent = defaultEventTransformer(domainEvent);

      expect(uiEvent).not.toBeNull();
      expect(uiEvent?.message).toBe('Hello World');
      expect(uiEvent?.severity).toBe('success');
      expect(uiEvent?.channel).toBe('ui');
      expect(uiEvent?.dismissed).toBe(false);
    });

    it('should generate default message when missing', () => {
      const domainEvent: DomainEvent = {
        channel: 'analytics',
        payload: {},
        timestamp: Date.now(),
      };

      const uiEvent = defaultEventTransformer(domainEvent);

      expect(uiEvent?.message).toBe('Event from analytics');
    });

    it('should extract description and duration', () => {
      const domainEvent: DomainEvent = {
        channel: 'ui',
        payload: {
          message: 'Test',
          description: 'Detailed info',
          duration: 5000,
        },
        timestamp: Date.now(),
      };

      const uiEvent = defaultEventTransformer(domainEvent);

      expect(uiEvent?.description).toBe('Detailed info');
      expect(uiEvent?.duration).toBe(5000);
    });

    it('should preserve original payload', () => {
      const payload = { message: 'Test', customField: 'value' };
      const domainEvent: DomainEvent = {
        channel: 'ui',
        payload,
        timestamp: Date.now(),
      };

      const uiEvent = defaultEventTransformer(domainEvent);

      expect(uiEvent?.payload).toBe(payload);
    });
  });

  describe('projectEvent', () => {
    it('should use default transformer', () => {
      const domainEvent: DomainEvent = {
        channel: 'ui',
        payload: { message: 'Test' },
        timestamp: Date.now(),
      };

      const uiEvent = projectEvent(domainEvent);

      expect(uiEvent?.message).toBe('Test');
    });

    it('should use custom transformer', () => {
      const domainEvent: DomainEvent = {
        channel: 'ui',
        payload: { msg: 'Custom' },
        timestamp: Date.now(),
      };

      const uiEvent = projectEvent(domainEvent, {
        transformer: (event) => ({
          id: generateEventId(),
          severity: 'success',
          message: (event.payload as { msg: string }).msg,
          channel: event.channel,
          payload: event.payload,
          timestamp: event.timestamp,
          dismissed: false,
        }),
      });

      expect(uiEvent?.message).toBe('Custom');
    });

    it('should use channel-specific transformer', () => {
      const domainEvent: DomainEvent = {
        channel: 'special',
        payload: {},
        timestamp: Date.now(),
      };

      const uiEvent = projectEvent(domainEvent, {
        channelTransformers: {
          special: () => ({
            id: generateEventId(),
            severity: 'warning',
            message: 'Special channel event',
            channel: 'special',
            payload: {},
            timestamp: Date.now(),
            dismissed: false,
          }),
        },
      });

      expect(uiEvent?.message).toBe('Special channel event');
      expect(uiEvent?.severity).toBe('warning');
    });

    it('should apply default duration when not set', () => {
      const domainEvent: DomainEvent = {
        channel: 'ui',
        payload: { message: 'Test' },
        timestamp: Date.now(),
      };

      const uiEvent = projectEvent(domainEvent, {
        defaultDuration: 3000,
      });

      expect(uiEvent?.duration).toBe(3000);
    });

    it('should not override explicit duration', () => {
      const domainEvent: DomainEvent = {
        channel: 'ui',
        payload: { message: 'Test', duration: 5000 },
        timestamp: Date.now(),
      };

      const uiEvent = projectEvent(domainEvent, {
        defaultDuration: 3000,
      });

      expect(uiEvent?.duration).toBe(5000);
    });
  });

  describe('createToastEvent', () => {
    it('should create basic toast', () => {
      const toast = createToastEvent('Hello');

      expect(toast.message).toBe('Hello');
      expect(toast.severity).toBe('info');
      expect(toast.channel).toBe('manual');
      expect(toast.dismissed).toBe(false);
    });

    it('should create toast with severity', () => {
      const toast = createToastEvent('Error occurred', 'error');

      expect(toast.severity).toBe('error');
    });

    it('should create toast with options', () => {
      const toast = createToastEvent('Test', 'success', {
        description: 'Details',
        duration: 5000,
        channel: 'custom',
      });

      expect(toast.description).toBe('Details');
      expect(toast.duration).toBe(5000);
      expect(toast.channel).toBe('custom');
    });
  });

  describe('toast helpers', () => {
    it('should create success toast', () => {
      const toast = createSuccessToast('Success!');
      expect(toast.severity).toBe('success');
      expect(toast.message).toBe('Success!');
    });

    it('should create error toast', () => {
      const toast = createErrorToast('Error!');
      expect(toast.severity).toBe('error');
    });

    it('should create warning toast', () => {
      const toast = createWarningToast('Warning!');
      expect(toast.severity).toBe('warning');
    });

    it('should create info toast', () => {
      const toast = createInfoToast('Info');
      expect(toast.severity).toBe('info');
    });
  });

  describe('filterPendingEvents', () => {
    it('should filter out dismissed events', () => {
      const events: UIEvent[] = [
        { id: '1', severity: 'info', message: 'A', channel: 'ui', payload: {}, timestamp: 1, dismissed: false },
        { id: '2', severity: 'info', message: 'B', channel: 'ui', payload: {}, timestamp: 2, dismissed: true },
        { id: '3', severity: 'info', message: 'C', channel: 'ui', payload: {}, timestamp: 3, dismissed: false },
      ];

      const pending = filterPendingEvents(events);

      expect(pending).toHaveLength(2);
      expect(pending.map((e) => e.id)).toEqual(['1', '3']);
    });
  });

  describe('dismissEvent', () => {
    it('should mark event as dismissed', () => {
      const events: UIEvent[] = [
        { id: '1', severity: 'info', message: 'A', channel: 'ui', payload: {}, timestamp: 1, dismissed: false },
        { id: '2', severity: 'info', message: 'B', channel: 'ui', payload: {}, timestamp: 2, dismissed: false },
      ];

      const updated = dismissEvent(events, '1');

      expect(updated[0]?.dismissed).toBe(true);
      expect(updated[1]?.dismissed).toBe(false);
      // Original should be unchanged
      expect(events[0]?.dismissed).toBe(false);
    });

    it('should handle non-existent event ID', () => {
      const events: UIEvent[] = [
        { id: '1', severity: 'info', message: 'A', channel: 'ui', payload: {}, timestamp: 1, dismissed: false },
      ];

      const updated = dismissEvent(events, 'nonexistent');

      expect(updated[0]?.dismissed).toBe(false);
    });
  });

  describe('dismissAllEvents', () => {
    it('should mark all events as dismissed', () => {
      const events: UIEvent[] = [
        { id: '1', severity: 'info', message: 'A', channel: 'ui', payload: {}, timestamp: 1, dismissed: false },
        { id: '2', severity: 'info', message: 'B', channel: 'ui', payload: {}, timestamp: 2, dismissed: false },
      ];

      const updated = dismissAllEvents(events);

      expect(updated.every((e) => e.dismissed)).toBe(true);
      // Originals should be unchanged
      expect(events.every((e) => !e.dismissed)).toBe(true);
    });
  });

  describe('getEventsBySeverity', () => {
    it('should filter by severity and exclude dismissed', () => {
      const events: UIEvent[] = [
        { id: '1', severity: 'error', message: 'Error 1', channel: 'ui', payload: {}, timestamp: 1, dismissed: false },
        { id: '2', severity: 'info', message: 'Info', channel: 'ui', payload: {}, timestamp: 2, dismissed: false },
        { id: '3', severity: 'error', message: 'Error 2', channel: 'ui', payload: {}, timestamp: 3, dismissed: true },
      ];

      const errors = getEventsBySeverity(events, 'error');

      expect(errors).toHaveLength(1);
      expect(errors[0]?.id).toBe('1');
    });
  });

  describe('getEventsByChannel', () => {
    it('should filter by channel and exclude dismissed', () => {
      const events: UIEvent[] = [
        { id: '1', severity: 'info', message: 'UI 1', channel: 'ui', payload: {}, timestamp: 1, dismissed: false },
        { id: '2', severity: 'info', message: 'Analytics', channel: 'analytics', payload: {}, timestamp: 2, dismissed: false },
        { id: '3', severity: 'info', message: 'UI 2', channel: 'ui', payload: {}, timestamp: 3, dismissed: true },
      ];

      const uiEvents = getEventsByChannel(events, 'ui');

      expect(uiEvents).toHaveLength(1);
      expect(uiEvents[0]?.id).toBe('1');
    });
  });
});
