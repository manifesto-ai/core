import { ManifestoError } from "@manifesto-ai/sdk";

export class PlannerActivationError extends ManifestoError {
  constructor(message: string) {
    super("PLANNER_ACTIVATION_ERROR", message);
    this.name = "PlannerActivationError";
  }
}
