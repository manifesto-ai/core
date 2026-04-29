import type {
  ActionArgs,
  ActionName,
  BaseSubmissionResult,
  ManifestoApp,
  ManifestoDomainShape,
  PreviewResult,
} from "../../index.ts";
import { createManifesto } from "../../index.ts";
import { createCounterSchema, type CounterDomain } from "../helpers/schema.ts";

function previewAction<
  T extends ManifestoDomainShape,
  Name extends ActionName<T>,
>(
  app: ManifestoApp<T, "base">,
  name: Name,
  ...args: ActionArgs<T, Name>
): PreviewResult<T, Name> {
  return app.action(name).bind(...args).preview();
}

function submitAction<
  T extends ManifestoDomainShape,
  Name extends ActionName<T>,
>(
  app: ManifestoApp<T, "base">,
  name: Name,
  ...args: ActionArgs<T, Name>
): Promise<BaseSubmissionResult<T, Name>> {
  return app.action(name).bind(...args).submit();
}

const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
const incrementPreview = previewAction(app, "increment");
const addPreview = previewAction(app, "add", 3);
const addSubmit = submitAction(app, "add", 3);

void incrementPreview;
void addPreview;
void addSubmit;

// @ts-expect-error helper action name is statically constrained
previewAction(app, "missing");
// @ts-expect-error helper action args are statically constrained
submitAction(app, "add", "wrong");

export {};
