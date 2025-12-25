"use client";

import { useState } from "react";
import {
  useScenarios,
  useScenarioResults,
  useScenarioRunner,
  useScenarioEditor,
  useSetValue,
} from "@/runtime";
import type { Scenario, ScenarioResult } from "@/runtime/scenario-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TestTube,
  Play,
  PlayCircle,
  Plus,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronRight,
  Trash2,
  Copy,
  Edit,
} from "lucide-react";
import { ScenarioEditor } from "./ScenarioEditor";
import { ScenarioResultView } from "./ScenarioResultView";

interface ScenarioItemProps {
  scenario: Scenario;
  result?: ScenarioResult;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isSelected: boolean;
  onSelect: () => void;
}

function ScenarioItem({
  scenario,
  result,
  onRun,
  onEdit,
  onDelete,
  onDuplicate,
  isSelected,
  onSelect,
}: ScenarioItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusBadge = () => {
    if (!result) {
      return (
        <Badge variant="secondary" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Not Run
        </Badge>
      );
    }

    if (result.passed) {
      return (
        <Badge
          variant="outline"
          className="text-neon-emerald border-neon-emerald/50 text-xs"
        >
          <Check className="h-3 w-3 mr-1" />
          Pass
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className="text-destructive border-destructive/50 text-xs"
      >
        <X className="h-3 w-3 mr-1" />
        Fail
      </Badge>
    );
  };

  return (
    <div
      className={`border-b border-border ${
        isSelected ? "bg-accent/50" : "hover:bg-accent/25"
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => {
          onSelect();
          setIsExpanded(!isExpanded);
        }}
      >
        <button
          className="p-0.5 hover:bg-accent rounded"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <span className="flex-1 text-sm font-medium truncate">
          {scenario.name}
        </span>

        {getStatusBadge()}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onRun();
          }}
          title="Run scenario"
        >
          <Play className="h-4 w-4" />
        </Button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-2 text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-4">
            <span>Given: {Object.keys(scenario.given).length} values</span>
            <span>When: {scenario.when.length} action(s)</span>
            <span>Then: {scenario.then.length} assertion(s)</span>
          </div>

          {scenario.description && (
            <p className="text-xs italic">{scenario.description}</p>
          )}

          <div className="flex items-center gap-1 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              <Copy className="h-3 w-3 mr-1" />
              Duplicate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>

          {/* Show result summary if exists */}
          {result && (
            <div className="pt-2 border-t border-border mt-2">
              <div className="flex items-center gap-2 text-xs">
                <span>Duration: {result.duration.toFixed(0)}ms</span>
                <span>
                  Steps: {result.steps.filter((s) => s.success).length}/
                  {result.steps.length}
                </span>
                <span>
                  Assertions: {result.assertions.filter((a) => a.passed).length}
                  /{result.assertions.length}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ScenarioPanel() {
  const { value: scenarios } = useScenarios();
  const { value: results } = useScenarioResults();
  const { runScenario, runAllScenarios, clearResults } = useScenarioRunner();
  const { deleteScenario, duplicateScenario } = useScenarioEditor();
  const { setValue } = useSetValue();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const scenarioList = Object.values(scenarios ?? {});
  const passedCount = scenarioList.filter(
    (s) => results?.[s.id]?.passed
  ).length;
  const hasResults = Object.keys(results ?? {}).length > 0;

  const handleCreateNew = () => {
    setEditingScenario(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (scenario: Scenario) => {
    setEditingScenario(scenario);
    setIsEditorOpen(true);
  };

  const handleRun = (id: string) => {
    runScenario(id);
  };

  const handleDelete = (id: string) => {
    deleteScenario(id);
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleDuplicate = (id: string) => {
    duplicateScenario(id);
  };

  // Get selected scenario result for detail view
  const selectedResult = selectedId ? results?.[selectedId] : null;
  const selectedScenario = selectedId ? scenarios?.[selectedId] : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TestTube className="h-4 w-4" />
          <h3 className="font-medium text-sm">Scenarios</h3>
        </div>
        <div className="flex items-center gap-2">
          {scenarioList.length > 0 && (
            <>
              <Badge variant="secondary" className="text-xs">
                {passedCount}/{scenarioList.length}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={runAllScenarios}
                title="Run all scenarios"
              >
                <PlayCircle className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCreateNew}
            title="Add scenario"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {scenarioList.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            <TestTube className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No scenarios yet</p>
            <p className="text-xs mt-1">
              Create a scenario to test your domain logic
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleCreateNew}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Scenario
            </Button>
          </div>
        ) : (
          <div>
            {scenarioList.map((scenario) => (
              <ScenarioItem
                key={scenario.id}
                scenario={scenario}
                result={results?.[scenario.id]}
                onRun={() => handleRun(scenario.id)}
                onEdit={() => handleEdit(scenario)}
                onDelete={() => handleDelete(scenario.id)}
                onDuplicate={() => handleDuplicate(scenario.id)}
                isSelected={selectedId === scenario.id}
                onSelect={() =>
                  setSelectedId(selectedId === scenario.id ? null : scenario.id)
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Result detail view */}
      {selectedScenario && selectedResult && (
        <div className="h-48 border-t border-border shrink-0 overflow-auto">
          <ScenarioResultView
            scenario={selectedScenario}
            result={selectedResult}
            onRerun={() => handleRun(selectedScenario.id)}
          />
        </div>
      )}

      {/* Editor dialog */}
      <ScenarioEditor
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        scenario={editingScenario}
      />
    </div>
  );
}
