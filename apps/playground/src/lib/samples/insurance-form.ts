import type { GeneratedSchema } from "@/lib/types/schema";

export const insuranceFormSchema: GeneratedSchema = {
  name: "Insurance Application",
  description: "Complete insurance application form with personal info, employment details, and coverage options",
  fields: {
    fullName: {
      type: "string",
      label: "Full Name",
      description: "Your legal full name as it appears on official documents",
      required: true,
      placeholder: "John Doe",
      validation: {
        minLength: 2,
        maxLength: 100,
      },
    },
    email: {
      type: "email",
      label: "Email Address",
      description: "We'll send your policy documents here",
      required: true,
      placeholder: "john@example.com",
    },
    phone: {
      type: "phone",
      label: "Phone Number",
      description: "For urgent policy matters",
      required: true,
      placeholder: "+1 (555) 123-4567",
    },
    dateOfBirth: {
      type: "date",
      label: "Date of Birth",
      description: "Used to calculate your premium",
      required: true,
    },
    employmentStatus: {
      type: "select",
      label: "Employment Status",
      required: true,
      options: [
        { value: "employed", label: "Employed Full-Time" },
        { value: "part-time", label: "Employed Part-Time" },
        { value: "self-employed", label: "Self-Employed" },
        { value: "unemployed", label: "Unemployed" },
        { value: "retired", label: "Retired" },
        { value: "student", label: "Student" },
      ],
    },
    annualIncome: {
      type: "number",
      label: "Annual Income (USD)",
      description: "Approximate annual income before taxes",
      required: true,
      placeholder: "50000",
      validation: {
        min: 0,
        max: 10000000,
      },
    },
    coverageType: {
      type: "select",
      label: "Coverage Type",
      description: "Select your preferred coverage level",
      required: true,
      options: [
        { value: "basic", label: "Basic - $100,000" },
        { value: "standard", label: "Standard - $250,000" },
        { value: "premium", label: "Premium - $500,000" },
        { value: "comprehensive", label: "Comprehensive - $1,000,000" },
      ],
    },
    existingConditions: {
      type: "boolean",
      label: "Pre-existing Conditions",
      description: "Do you have any pre-existing medical conditions?",
      required: false,
      defaultValue: false,
    },
    conditionsDescription: {
      type: "textarea",
      label: "Conditions Description",
      description: "Please describe your pre-existing conditions if any",
      required: false,
      placeholder: "List any medical conditions...",
      validation: {
        maxLength: 1000,
      },
    },
    agreeToTerms: {
      type: "boolean",
      label: "Terms Agreement",
      description: "I agree to the terms and conditions",
      required: true,
      defaultValue: false,
    },
  },
  actions: {
    submit: {
      label: "Submit Application",
      description: "Submit your insurance application for review",
    },
  },
};
