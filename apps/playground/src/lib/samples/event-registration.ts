import type { GeneratedSchema } from "@/lib/types/schema";

export const eventRegistrationSchema: GeneratedSchema = {
  name: "Event Registration",
  description: "Register for our upcoming tech conference with session preferences and dietary requirements",
  fields: {
    firstName: {
      type: "string",
      label: "First Name",
      required: true,
      placeholder: "John",
      validation: {
        minLength: 1,
        maxLength: 50,
      },
    },
    lastName: {
      type: "string",
      label: "Last Name",
      required: true,
      placeholder: "Doe",
      validation: {
        minLength: 1,
        maxLength: 50,
      },
    },
    email: {
      type: "email",
      label: "Email Address",
      description: "Your ticket will be sent to this email",
      required: true,
      placeholder: "john.doe@company.com",
    },
    company: {
      type: "string",
      label: "Company/Organization",
      required: false,
      placeholder: "Acme Inc.",
    },
    jobTitle: {
      type: "string",
      label: "Job Title",
      required: false,
      placeholder: "Software Engineer",
    },
    ticketType: {
      type: "select",
      label: "Ticket Type",
      description: "Select your registration tier",
      required: true,
      options: [
        { value: "general", label: "General Admission - $199" },
        { value: "vip", label: "VIP Pass - $499" },
        { value: "speaker", label: "Speaker Pass" },
        { value: "sponsor", label: "Sponsor Pass" },
      ],
    },
    sessions: {
      type: "multiselect",
      label: "Interested Sessions",
      description: "Select sessions you'd like to attend",
      required: false,
      options: [
        { value: "keynote", label: "Opening Keynote" },
        { value: "ai-workshop", label: "AI/ML Workshop" },
        { value: "cloud-native", label: "Cloud Native Development" },
        { value: "security", label: "Security Best Practices" },
        { value: "networking", label: "Networking Lunch" },
        { value: "closing", label: "Closing Ceremony" },
      ],
    },
    dietaryRestrictions: {
      type: "select",
      label: "Dietary Restrictions",
      description: "For catering purposes",
      required: false,
      options: [
        { value: "none", label: "None" },
        { value: "vegetarian", label: "Vegetarian" },
        { value: "vegan", label: "Vegan" },
        { value: "gluten-free", label: "Gluten-Free" },
        { value: "halal", label: "Halal" },
        { value: "kosher", label: "Kosher" },
        { value: "other", label: "Other (please specify)" },
      ],
    },
    otherDietary: {
      type: "string",
      label: "Other Dietary Requirements",
      description: "Specify if you selected 'Other' above",
      required: false,
      placeholder: "Nut allergy, etc.",
    },
    tshirtSize: {
      type: "select",
      label: "T-Shirt Size",
      description: "For your conference swag bag",
      required: false,
      options: [
        { value: "xs", label: "XS" },
        { value: "s", label: "S" },
        { value: "m", label: "M" },
        { value: "l", label: "L" },
        { value: "xl", label: "XL" },
        { value: "xxl", label: "XXL" },
      ],
    },
    specialRequirements: {
      type: "textarea",
      label: "Special Requirements",
      description: "Accessibility needs or other special requirements",
      required: false,
      placeholder: "Wheelchair access, sign language interpreter, etc.",
      validation: {
        maxLength: 500,
      },
    },
    receiveUpdates: {
      type: "boolean",
      label: "Receive Updates",
      description: "I'd like to receive event updates and promotional emails",
      required: false,
      defaultValue: true,
    },
    agreeToCodeOfConduct: {
      type: "boolean",
      label: "Code of Conduct",
      description: "I agree to abide by the event's code of conduct",
      required: true,
      defaultValue: false,
    },
  },
  actions: {
    submit: {
      label: "Complete Registration",
      description: "Submit your event registration",
    },
  },
};
