"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Send } from "lucide-react";
import type { GeneratedSchema, FieldDefinition } from "@/lib/types/schema";

interface DynamicFormProps {
  schema: GeneratedSchema;
  defaultValues: Record<string, unknown>;
  onDataChange: (data: Record<string, unknown>) => void;
}

function FieldRenderer({
  name,
  field,
  register,
  errors,
}: {
  name: string;
  field: FieldDefinition;
  register: ReturnType<typeof useForm>["register"];
  errors: Record<string, { message?: string }>;
}) {
  const error = errors[name];

  const renderInput = () => {
    switch (field.type) {
      case "textarea":
        return (
          <Textarea
            {...register(name)}
            placeholder={field.placeholder}
            className={error ? "border-destructive" : ""}
          />
        );

      case "select":
        return (
          <select
            {...register(name)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              {...register(name)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-muted-foreground">
              {field.description || "Yes"}
            </span>
          </div>
        );

      case "number":
        return (
          <Input
            type="number"
            {...register(name, { valueAsNumber: true })}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            className={error ? "border-destructive" : ""}
          />
        );

      case "date":
        return (
          <Input
            type="date"
            {...register(name)}
            className={error ? "border-destructive" : ""}
          />
        );

      case "email":
        return (
          <Input
            type="email"
            {...register(name)}
            placeholder={field.placeholder || "email@example.com"}
            className={error ? "border-destructive" : ""}
          />
        );

      case "phone":
        return (
          <Input
            type="tel"
            {...register(name)}
            placeholder={field.placeholder || "+1 (555) 000-0000"}
            className={error ? "border-destructive" : ""}
          />
        );

      default:
        return (
          <Input
            type="text"
            {...register(name)}
            placeholder={field.placeholder}
            className={error ? "border-destructive" : ""}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </Label>
      {renderInput()}
      {field.description && field.type !== "boolean" && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      {error?.message && (
        <p className="text-xs text-destructive">{error.message}</p>
      )}
    </div>
  );
}

export function DynamicForm({ schema, defaultValues, onDataChange }: DynamicFormProps) {
  const {
    register,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: defaultValues as Record<string, string | number | boolean>,
  });

  // Track if change is from form or external
  const isExternalUpdate = React.useRef(false);

  // Sync form with external defaultValues changes (from runtime/agent)
  useEffect(() => {
    isExternalUpdate.current = true;
    reset(defaultValues as Record<string, string | number | boolean>);
    // Small delay to reset the flag after React processes the update
    const timer = setTimeout(() => {
      isExternalUpdate.current = false;
    }, 0);
    return () => clearTimeout(timer);
  }, [defaultValues, reset]);

  // Watch all form values and notify parent (only for user input)
  useEffect(() => {
    const subscription = watch((data) => {
      if (!isExternalUpdate.current) {
        onDataChange(data as Record<string, unknown>);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onDataChange]);

  const onSubmit = (data: Record<string, unknown>) => {
    console.log("Form submitted:", data);
    // In a real app, this would trigger an action
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {schema.name}
        </CardTitle>
        {schema.description && (
          <CardDescription className="text-xs">
            {schema.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {Object.entries(schema.fields).map(([name, field]) => (
            <FieldRenderer
              key={name}
              name={name}
              field={field}
              register={register}
              errors={errors as Record<string, { message?: string }>}
            />
          ))}

          {/* Submit button from actions */}
          {schema.actions?.submit && (
            <Button type="submit" className="w-full mt-6">
              <Send className="mr-2 h-4 w-4" />
              {schema.actions.submit.label || "Submit"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
