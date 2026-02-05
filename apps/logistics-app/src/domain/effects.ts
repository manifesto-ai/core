/**
 * Logistics Effects - v2.3.0 Effects-first API
 *
 * Effects handle external side-effects (mock API calls in this case).
 * Each effect returns Patch[] to update state.
 */

import type { Patch } from "@manifesto-ai/core";
import type { Effects } from "@manifesto-ai/app";

// =============================================================================
// Mock Data
// =============================================================================

const mockShipments = () => ({
  "ship-001": {
    id: "ship-001",
    customerId: "customer-1",
    vesselId: "vessel-A",
    vesselName: "Ever Given",
    laneId: "KRPUS-USLAX",
    destinationPort: "USLAX",
    origin: "Busan, KR",
    destination: "Los Angeles, US",
    schedule: { eta: Date.now() + 86400000 * 7, route: "KRPUS→USLAX" },
  },
  "ship-002": {
    id: "ship-002",
    customerId: "customer-1",
    vesselId: "vessel-B",
    vesselName: "MSC Oscar",
    laneId: "KRPUS-JPTYO",
    destinationPort: "JPTYO",
    origin: "Busan, KR",
    destination: "Tokyo, JP",
    schedule: { eta: Date.now() + 86400000 * 3, route: "KRPUS→JPTYO" },
  },
  "ship-003": {
    id: "ship-003",
    customerId: "customer-1",
    vesselId: "vessel-C",
    vesselName: "HMM Algeciras",
    laneId: "KRPUS-DEHAM",
    destinationPort: "DEHAM",
    origin: "Busan, KR",
    destination: "Hamburg, DE",
    schedule: { eta: Date.now() + 86400000 * 14, route: "KRPUS→DEHAM" },
  },
});

const mockSignals = () => ({
  ais: {
    positionsByShipment: {
      "ship-001": { lat: 35.6, lng: -140.2, timestamp: Date.now() },
      "ship-002": { lat: 34.0, lng: 135.0, timestamp: Date.now() },
      "ship-003": { lat: 45.2, lng: -30.5, timestamp: Date.now() },
    },
  },
  tos: {
    portCongestionIndexByPort: { USLAX: 0.3, JPTYO: 0.1, DEHAM: 0.5 },
  },
  weather: {
    typhoonDelayIndexByLane: { "KRPUS-USLAX": 0.2, "KRPUS-JPTYO": 0.0, "KRPUS-DEHAM": 0.1 },
  },
  errors: null,
});

const mockCarrierQuotes = () => ({
  "carrier-maersk": {
    carrierId: "carrier-maersk",
    name: "Maersk",
    price: 2500,
    currency: "USD",
    transitDays: 14,
    status: "ok",
    receivedWithinMs: 1200,
  },
  "carrier-msc": {
    carrierId: "carrier-msc",
    name: "MSC",
    price: 2300,
    currency: "USD",
    transitDays: 16,
    status: "ok",
    receivedWithinMs: 2800,
  },
  "carrier-cosco": {
    carrierId: "carrier-cosco",
    name: "COSCO",
    price: 2100,
    currency: "USD",
    transitDays: 18,
    status: "timeout",
    receivedWithinMs: 5000,
  },
  "carrier-evergreen": {
    carrierId: "carrier-evergreen",
    name: "Evergreen",
    price: 2400,
    currency: "USD",
    transitDays: 15,
    status: "ok",
    receivedWithinMs: 1800,
  },
});

const mockBlMeta = () => ({
  orderId: "order-123",
  shipper: "Samsung Electronics",
  consignee: "Best Buy Inc.",
  vessel: "Ever Given",
  voyage: "VOY-2024-001",
  portOfLoading: "KRPUS",
  portOfDischarge: "USLAX",
});

const mockExtractedFields = () => ({
  containerNos: ["MSCU1234567", "MSCU7654321"],
  hsCodes: ["8471.30", "8542.31"],
  fields: [
    { key: "shipper", value: "Samsung Electronics" },
    { key: "consignee", value: "Best Buy Inc." },
    { key: "vessel", value: "Ever Given" },
    { key: "weight", value: "15,000 kg" },
  ],
});

const mockUnipassResult = () => ({
  items: [
    { hsCode: "8471.30", containerNo: "MSCU1234567", risk: "allow", description: "Computer parts" },
    { hsCode: "8542.31", containerNo: "MSCU7654321", risk: "deny", description: "Semiconductor chips - requires license" },
  ],
});

const mockImpactedOrders = () => ({
  "order-101": {
    id: "order-101",
    vesselId: "vessel-A",
    vesselName: "Ever Given",
    customer: "ABC Corp",
    schedule: { eta: Date.now() + 86400000 * 5, route: "KRPUS→USLAX" },
  },
  "order-102": {
    id: "order-102",
    vesselId: "vessel-C",
    vesselName: "HMM Algeciras",
    customer: "XYZ Ltd",
    schedule: { eta: Date.now() + 86400000 * 7, route: "KRPUS→USLAX" },
  },
});

const mockAlternatives = () => ({
  "order-101": { eta: Date.now() + 86400000 * 8, route: "KRPUS→JPOSA→USLAX", deltaHours: 72 },
  "order-102": { eta: Date.now() + 86400000 * 9, route: "KRPUS→TWKHH→USLAX", deltaHours: 48 },
});

// =============================================================================
// Helpers
// =============================================================================

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// =============================================================================
// Effects (v2.3.0 API)
// =============================================================================

export const logisticsEffects: Effects = {
  // =========================================================================
  // Tracking
  // =========================================================================

  "api.shipment.listActive": async (): Promise<readonly Patch[]> => {
    await delay(300);
    return [{ op: "set", path: "trackingShipments", value: mockShipments() }];
  },

  "api.tracking.aggregateSignals": async (): Promise<readonly Patch[]> => {
    await delay(200);
    return [{ op: "set", path: "trackingSignals", value: mockSignals() }];
  },

  // =========================================================================
  // Quoting
  // =========================================================================

  "api.erp.getCustomerCredit": async (): Promise<readonly Patch[]> => {
    await delay(150);
    return [{ op: "set", path: "quotingCredit", value: { limit: 100000, used: 25000, available: 75000 } }];
  },

  "api.quote.requestAllCarriers": async (): Promise<readonly Patch[]> => {
    await delay(500);
    return [{ op: "set", path: "quotingQuotes", value: mockCarrierQuotes() }];
  },

  // =========================================================================
  // Documents
  // =========================================================================

  "api.bl.fetchMetadata": async (): Promise<readonly Patch[]> => {
    await delay(200);
    return [{ op: "set", path: "documentsMeta", value: mockBlMeta() }];
  },

  "api.bl.fetchPdf": async (): Promise<readonly Patch[]> => {
    await delay(300);
    return [{ op: "set", path: "documentsPdf", value: { data: "JVBERi0xLjQK...", mimeType: "application/pdf" } }];
  },

  "ocr.extractText": async (): Promise<readonly Patch[]> => {
    await delay(400);
    const text = `BILL OF LADING
Shipper: Samsung Electronics
Consignee: Best Buy Inc.
Container: MSCU1234567, MSCU7654321
HS Code: 8471.30, 8542.31
Port of Loading: KRPUS
Port of Discharge: USLAX`;
    return [{ op: "set", path: "documentsOcrText", value: text }];
  },

  "ocr.extractBlFields": async (): Promise<readonly Patch[]> => {
    await delay(300);
    return [{ op: "set", path: "documentsExtracted", value: mockExtractedFields() }];
  },

  "api.unipass.checkCustomsRisk": async (): Promise<readonly Patch[]> => {
    await delay(250);
    return [{ op: "set", path: "documentsUnipass", value: mockUnipassResult() }];
  },

  // =========================================================================
  // Disruptions
  // =========================================================================

  "api.orders.searchActiveByPort": async (): Promise<readonly Patch[]> => {
    await delay(300);
    return [{ op: "set", path: "disruptionImpactedOrders", value: mockImpactedOrders() }];
  },

  "api.notify.broadcastDisruption": async (): Promise<readonly Patch[]> => {
    await delay(200);
    return [{ op: "set", path: "disruptionNotification", value: { sent: 15, failed: 0, timestamp: Date.now() } }];
  },

  "api.route.findAlternativeRoutes": async (): Promise<readonly Patch[]> => {
    await delay(400);
    return [{ op: "set", path: "disruptionAlternatives", value: mockAlternatives() }];
  },

  // =========================================================================
  // Utility
  // =========================================================================

  "record.keys": async (params): Promise<readonly Patch[]> => {
    const source = (params as { source?: Record<string, unknown> }).source;
    const into = (params as { into?: string }).into ?? "";
    return [{ op: "set", path: into, value: source ? Object.keys(source) : [] }];
  },

  "record.filter": async (params): Promise<readonly Patch[]> => {
    const source = (params as { source?: Record<string, unknown> }).source;
    const into = (params as { into?: string }).into ?? "";
    return [{ op: "set", path: into, value: source ?? {} }];
  },

  "record.mapValues": async (params): Promise<readonly Patch[]> => {
    const into = (params as { into?: string }).into ?? "";
    return [{ op: "set", path: into, value: {} }];
  },

  "array.filter": async (params): Promise<readonly Patch[]> => {
    const source = (params as { source?: unknown[] }).source;
    const into = (params as { into?: string }).into ?? "";
    return [{ op: "set", path: into, value: source ?? [] }];
  },
};
