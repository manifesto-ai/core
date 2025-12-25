"use client";

import { useState, useEffect } from "react";
import { useScenarioEditor, useAllPaths, useActionBlocks } from "@/runtime";
import type { Scenario, ScenarioStep, ScenarioAssertion, AssertionOperator } from "@/runtime/scenario-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";

interface ScenarioEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario: Scenario | null;
}

// Given value editor
interface GivenValue {
  path: string;
  value: string; // JSON string
}

function GivenSection({
  values,
  onChange,
  allPaths,
}: {
  values: GivenValue[];
  onChange: (values: GivenValue[]) => void;
  allPaths: string[];
}) {
  const addValue = () => {
    onChange([...values, { path: "", value: "" }]);
  };

  const updateValue = (index: number, updates: Partial<GivenValue>) => {
    const newValues = [...values];
    newValues[index] = { ...newValues[index], ...updates };
    onChange(newValues);
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Given (Initial State)</Label>
        <Button variant="ghost" size="sm" onClick={addValue}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      {values.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No initial values defined
        </p>
      ) : (
        <div className="space-y-2">
          {values.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="path (e.g., data.count)"
                value={v.path}
                onChange={(e) => updateValue(i, { path: e.target.value })}
                className="flex-1 h-8 text-sm font-mono"
                list="paths-list"
              />
              <Input
                placeholder="value (JSON)"
                value={v.value}
                onChange={(e) => updateValue(i, { value: e.target.value })}
                className="flex-1 h-8 text-sm font-mono"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => removeValue(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <datalist id="paths-list">
        {Array.isArray(allPaths) && allPaths.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </div>
  );
}

// When (actions) editor
interface WhenValue {
  action: string;
  input: string; // JSON string
}

function WhenSection({
  steps,
  onChange,
  actions,
}: {
  steps: WhenValue[];
  onChange: (steps: WhenValue[]) => void;
  actions: string[];
}) {
  const addStep = () => {
    onChange([...steps, { action: "", input: "" }]);
  };

  const updateStep = (index: number, updates: Partial<WhenValue>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    onChange(newSteps);
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">When (Actions)</Label>
        <Button variant="ghost" size="sm" onClick={addStep}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      {steps.length === 0 ? (
        <p className="text-xs text-muted-foreground">No actions defined</p>
      ) : (
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4">
                {i + 1}.
              </span>
              <Select
                value={step.action}
                onChange={(e) => updateStep(i, { action: e.target.value })}
                className="flex-1 h-8 text-sm font-mono"
              >
                <option value="">Select action</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="input (JSON, optional)"
                value={step.input}
                onChange={(e) => updateStep(i, { input: e.target.value })}
                className="flex-1 h-8 text-sm font-mono"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => removeStep(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Then (assertions) editor
interface ThenValue {
  path: string;
  operator: AssertionOperator;
  expected: string; // JSON string
}

const OPERATORS: { value: AssertionOperator; label: string }[] = [
  { value: "eq", label: "==" },
  { value: "neq", label: "!=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "contains", label: "contains" },
  { value: "length", label: "length ==" },
  { value: "truthy", label: "is truthy" },
  { value: "falsy", label: "is falsy" },
];

function ThenSection({
  assertions,
  onChange,
  allPaths,
}: {
  assertions: ThenValue[];
  onChange: (assertions: ThenValue[]) => void;
  allPaths: string[];
}) {
  const addAssertion = () => {
    onChange([...assertions, { path: "", operator: "eq", expected: "" }]);
  };

  const updateAssertion = (index: number, updates: Partial<ThenValue>) => {
    const newAssertions = [...assertions];
    newAssertions[index] = { ...newAssertions[index], ...updates };
    onChange(newAssertions);
  };

  const removeAssertion = (index: number) => {
    onChange(assertions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Then (Assertions)</Label>
        <Button variant="ghost" size="sm" onClick={addAssertion}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      {assertions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No assertions defined</p>
      ) : (
        <div className="space-y-2">
          {assertions.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="path"
                value={a.path}
                onChange={(e) => updateAssertion(i, { path: e.target.value })}
                className="flex-1 h-8 text-sm font-mono"
                list="paths-list"
              />
              <Select
                value={a.operator}
                onChange={(e) =>
                  updateAssertion(i, { operator: e.target.value as AssertionOperator })
                }
                className="w-28 h-8 text-sm"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </Select>
              {!["truthy", "falsy"].includes(a.operator) && (
                <Input
                  placeholder="expected (JSON)"
                  value={a.expected}
                  onChange={(e) =>
                    updateAssertion(i, { expected: e.target.value })
                  }
                  className="flex-1 h-8 text-sm font-mono"
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => removeAssertion(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScenarioEditor({
  open,
  onOpenChange,
  scenario,
}: ScenarioEditorProps) {
  const { addScenario, updateScenario } = useScenarioEditor();
  const { value: allPaths } = useAllPaths();
  const { value: actionBlocks } = useActionBlocks();

  const isNew = !scenario;
  const actionPaths = Object.values(actionBlocks ?? {}).map((a) => a.path);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [givenValues, setGivenValues] = useState<GivenValue[]>([]);
  const [whenSteps, setWhenSteps] = useState<WhenValue[]>([]);
  const [thenAssertions, setThenAssertions] = useState<ThenValue[]>([]);

  // Reset form when scenario changes
  useEffect(() => {
    if (scenario) {
      setName(scenario.name);
      setDescription(scenario.description ?? "");
      setGivenValues(
        Object.entries(scenario.given).map(([path, value]) => ({
          path,
          value: JSON.stringify(value),
        }))
      );
      setWhenSteps(
        scenario.when.map((step) => ({
          action: step.action,
          input: step.input ? JSON.stringify(step.input) : "",
        }))
      );
      setThenAssertions(
        scenario.then.map((a) => ({
          path: a.path,
          operator: a.operator,
          expected: a.expected !== undefined ? JSON.stringify(a.expected) : "",
        }))
      );
    } else {
      // Reset for new scenario
      setName("");
      setDescription("");
      setGivenValues([]);
      setWhenSteps([]);
      setThenAssertions([]);
    }
  }, [scenario, open]);

  const handleSave = () => {
    // Build scenario object
    const given: Record<string, unknown> = {};
    for (const v of givenValues) {
      if (v.path) {
        try {
          given[v.path] = JSON.parse(v.value);
        } catch {
          given[v.path] = v.value; // Use as string if not valid JSON
        }
      }
    }

    const when: ScenarioStep[] = whenSteps
      .filter((s) => s.action)
      .map((s) => {
        const step: ScenarioStep = { action: s.action };
        if (s.input) {
          try {
            step.input = JSON.parse(s.input);
          } catch {
            // Skip invalid input
          }
        }
        return step;
      });

    const then: ScenarioAssertion[] = thenAssertions
      .filter((a) => a.path)
      .map((a) => {
        const assertion: ScenarioAssertion = {
          path: a.path,
          operator: a.operator,
        };
        if (!["truthy", "falsy"].includes(a.operator) && a.expected) {
          try {
            assertion.expected = JSON.parse(a.expected);
          } catch {
            assertion.expected = a.expected; // Use as string
          }
        }
        return assertion;
      });

    const newScenario: Scenario = {
      id: scenario?.id ?? `scenario-${Date.now()}`,
      name: name || "Untitled Scenario",
      description: description || undefined,
      given,
      when,
      then,
    };

    if (isNew) {
      addScenario(newScenario);
    } else {
      updateScenario(newScenario.id, newScenario);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Create Scenario" : "Edit Scenario"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Test Scenario"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this scenario test?"
              rows={2}
            />
          </div>

          <div className="border-t pt-4">
            <GivenSection
              values={givenValues}
              onChange={setGivenValues}
              allPaths={allPaths ?? []}
            />
          </div>

          <div className="border-t pt-4">
            <WhenSection
              steps={whenSteps}
              onChange={setWhenSteps}
              actions={actionPaths}
            />
          </div>

          <div className="border-t pt-4">
            <ThenSection
              assertions={thenAssertions}
              onChange={setThenAssertions}
              allPaths={allPaths ?? []}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isNew ? "Create" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
