/**
 * Mock Effect Handlers for Shipment App
 *
 * Simple mock implementations for testing the MEL domain.
 * - API effects return mock data
 * - record.keys is implemented for real
 * - Other utility effects return mock data (expression evaluation is complex)
 */

import { toPatch } from "@manifesto-ai/effect-utils";
import type { Patch } from "@manifesto-ai/core";

type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: { snapshot: unknown }
) => Promise<Patch[]>;

// =============================================================================
// Mock Data Generators
// =============================================================================

function mockShipments() {
  return {
    "ship-001": {
      id: "ship-001",
      customerId: "customer-1",
      vesselId: "vessel-A",
      laneId: "KRPUS-USLAX",
      destinationPort: "USLAX",
      schedule: { eta: Date.now() + 86400000 * 7, route: "KRPUS→USLAX" },
    },
    "ship-002": {
      id: "ship-002",
      customerId: "customer-1",
      vesselId: "vessel-B",
      laneId: "KRPUS-JPTYO",
      destinationPort: "JPTYO",
      schedule: { eta: Date.now() + 86400000 * 3, route: "KRPUS→JPTYO" },
    },
  };
}

function mockSignals() {
  return {
    ais: {
      positionsByShipment: {
        "ship-001": { lat: 35.6, lng: 139.7, timestamp: Date.now() },
        "ship-002": { lat: 34.0, lng: 135.0, timestamp: Date.now() },
      },
      speedAnomalyIndexByShipment: { "ship-001": 0.1, "ship-002": 0.0 },
    },
    tos: {
      portCongestionIndexByPort: { USLAX: 0.3, JPTYO: 0.1 },
    },
    weather: {
      typhoonDelayIndexByLane: { "KRPUS-USLAX": 0.2, "KRPUS-JPTYO": 0.0 },
    },
    errors: null,
  };
}

function mockCarrierQuotes() {
  return {
    "carrier-maersk": {
      carrierId: "carrier-maersk",
      price: 2500,
      transitDays: 14,
      status: "ok",
      receivedWithinMs: 1200,
    },
    "carrier-msc": {
      carrierId: "carrier-msc",
      price: 2300,
      transitDays: 16,
      status: "ok",
      receivedWithinMs: 2800,
    },
    "carrier-cosco": {
      carrierId: "carrier-cosco",
      price: 2100,
      transitDays: 18,
      status: "timeout",
      receivedWithinMs: 5000,
    },
  };
}

function mockBlMeta() {
  return {
    orderId: "order-123",
    shipper: "ABC Corp",
    consignee: "XYZ Ltd",
    vessel: "Ever Given",
    voyage: "VOY-2024-001",
  };
}

function mockOcrText() {
  return `
BILL OF LADING
Shipper: ABC Corp
Consignee: XYZ Ltd
Container: MSCU1234567, MSCU7654321
HS Code: 8471.30, 8542.31
Port of Loading: KRPUS
Port of Discharge: USLAX
  `.trim();
}

function mockExtractedFields() {
  return {
    containerNos: ["MSCU1234567", "MSCU7654321"],
    hsCodes: ["8471.30", "8542.31"],
    fields: [
      { key: "shipper", value: "ABC Corp" },
      { key: "consignee", value: "XYZ Ltd" },
    ],
  };
}

function mockUnipassResult() {
  return {
    items: [
      { hsCode: "8471.30", containerNo: "MSCU1234567", risk: "allow" },
      { hsCode: "8542.31", containerNo: "MSCU7654321", risk: "deny" },
    ],
  };
}

function mockImpactedOrders() {
  return {
    "order-101": {
      id: "order-101",
      vesselId: "vessel-A",
      schedule: { eta: Date.now() + 86400000 * 5, route: "KRPUS→USLAX" },
    },
    "order-102": {
      id: "order-102",
      vesselId: "vessel-C",
      schedule: { eta: Date.now() + 86400000 * 7, route: "KRPUS→USLAX" },
    },
  };
}

function mockAlternatives() {
  return {
    "order-101": { eta: Date.now() + 86400000 * 8, route: "KRPUS→JPOSA→USLAX", deltaHours: 72 },
    "order-102": { eta: Date.now() + 86400000 * 9, route: "KRPUS→TWKHH→USLAX", deltaHours: 48 },
  };
}

// =============================================================================
// Effect Handlers
// =============================================================================

// --- Tracking ---

const shipmentListActiveHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`, { customerId: params.customerId });
  const into = params.into as string;
  return [toPatch(into, mockShipments())];
};

const trackingAggregateSignalsHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`, { customerId: params.customerId });
  const into = params.into as string;
  return [toPatch(into, mockSignals())];
};

// --- Quoting ---

const erpGetCustomerCreditHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`, { customerId: params.customerId });
  const into = params.into as string;
  return [toPatch(into, { limit: 100000, used: 25000, available: 75000 })];
};

const quoteRequestAllCarriersHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`, { origin: params.origin, destination: params.destination });
  const into = params.into as string;
  return [toPatch(into, mockCarrierQuotes())];
};

// --- Documents ---

const blFetchMetadataHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`, { orderId: params.orderId });
  const into = params.into as string;
  return [toPatch(into, mockBlMeta())];
};

const blFetchPdfHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`, { orderId: params.orderId });
  const into = params.into as string;
  // Mock PDF as base64 placeholder
  return [toPatch(into, { data: "JVBERi0xLjQK...", mimeType: "application/pdf" })];
};

const ocrExtractTextHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`);
  const into = params.into as string;
  return [toPatch(into, mockOcrText())];
};

const ocrExtractBlFieldsHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`);
  const into = params.into as string;
  return [toPatch(into, mockExtractedFields())];
};

const unipassCheckCustomsRiskHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`, { hsCodes: params.hsCodes });
  const into = params.into as string;
  return [toPatch(into, mockUnipassResult())];
};

// --- Disruptions ---

const ordersSearchActiveByPortHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`, { portCode: params.portCode });
  const into = params.into as string;
  return [toPatch(into, mockImpactedOrders())];
};

const notifyBroadcastDisruptionHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`, { eventId: params.eventId, kind: params.kind });
  const into = params.into as string;
  return [toPatch(into, { sent: 15, failed: 0, timestamp: Date.now() })];
};

const routeFindAlternativeRoutesHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`, { eventId: params.eventId });
  const into = params.into as string;
  return [toPatch(into, mockAlternatives())];
};

// =============================================================================
// Utility Effects (실제 구현)
// =============================================================================

const recordKeysHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type}`);
  const source = params.source as Record<string, unknown> | null;
  const into = params.into as string;
  const keys = source ? Object.keys(source) : [];
  return [toPatch(into, keys)];
};

const recordFilterHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type} (mock - expression evaluation not supported)`);
  const source = params.source as Record<string, unknown> | null;
  const into = params.into as string;
  // Mock: return source as-is (can't evaluate where expression in Host)
  return [toPatch(into, source ?? {})];
};

const recordMapValuesHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type} (mock - expression evaluation not supported)`);
  const into = params.into as string;
  // Mock: return empty object (can't evaluate select expression in Host)
  // In real scenario, this would need Core's evaluateExpr
  return [toPatch(into, {})];
};

const arrayFilterHandler: EffectHandler = async (type, params) => {
  console.log(`[Effect] ${type} (mock - expression evaluation not supported)`);
  const source = params.source as unknown[] | null;
  const into = params.into as string;
  // Mock: return source as-is
  return [toPatch(into, source ?? [])];
};

// =============================================================================
// Registration
// =============================================================================

export function registerMockHandlers(host: {
  registerEffect: (type: string, handler: EffectHandler) => void;
}) {
  console.log("[Handlers] Registering mock effect handlers...");

  // Tracking
  host.registerEffect("api.shipment.listActive", shipmentListActiveHandler);
  host.registerEffect("api.tracking.aggregateSignals", trackingAggregateSignalsHandler);

  // Quoting
  host.registerEffect("api.erp.getCustomerCredit", erpGetCustomerCreditHandler);
  host.registerEffect("api.quote.requestAllCarriers", quoteRequestAllCarriersHandler);

  // Documents
  host.registerEffect("api.bl.fetchMetadata", blFetchMetadataHandler);
  host.registerEffect("api.bl.fetchPdf", blFetchPdfHandler);
  host.registerEffect("ocr.extractText", ocrExtractTextHandler);
  host.registerEffect("ocr.extractBlFields", ocrExtractBlFieldsHandler);
  host.registerEffect("api.unipass.checkCustomsRisk", unipassCheckCustomsRiskHandler);

  // Disruptions
  host.registerEffect("api.orders.searchActiveByPort", ordersSearchActiveByPortHandler);
  host.registerEffect("api.notify.broadcastDisruption", notifyBroadcastDisruptionHandler);
  host.registerEffect("api.route.findAlternativeRoutes", routeFindAlternativeRoutesHandler);

  // Utility effects
  host.registerEffect("record.keys", recordKeysHandler);
  host.registerEffect("record.filter", recordFilterHandler);
  host.registerEffect("record.mapValues", recordMapValuesHandler);
  host.registerEffect("array.filter", arrayFilterHandler);

  console.log("[Handlers] Registered 16 effect handlers");
}
