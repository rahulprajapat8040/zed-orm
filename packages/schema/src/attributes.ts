export interface AttributeArgumentDefinition {
  readonly name: string;
  readonly description: string;
  readonly values?: readonly string[];
}

export interface AttributeDefinition {
  readonly name: string;
  readonly description: string;
  readonly snippet?: string;
  readonly arguments?: readonly AttributeArgumentDefinition[];
}

export const FIELD_ATTRIBUTE_DEFINITIONS: readonly AttributeDefinition[] = [
  { name: "id", description: "Marks this field as a model identifier." },
  { name: "unique", description: "Requires this field to be unique." },
  {
    name: "default",
    description: "Sets the field's initial value.",
    snippet: "default($1)",
  },
  {
    name: "updatedAt",
    description: "Updates this DateTime field when the record changes.",
  },
  {
    name: "relation",
    description: "Defines the local and referenced fields for a relation.",
    snippet: "relation(fields: [$1], references: [$2])",
    arguments: [
      { name: "fields", description: "Local fields used by this relation." },
      {
        name: "references",
        description: "Fields on the related model referenced by this relation.",
      },
      { name: "name", description: "Optional relation name." },
      {
        name: "onSoftDelete",
        description: "Policy applied when the related record is soft-deleted.",
        values: ["Cascade", "Restrict", "Nullify", "Ignore"],
      },
    ],
  },
];

export const BLOCK_ATTRIBUTE_DEFINITIONS: readonly AttributeDefinition[] = [
  {
    name: "id",
    description: "Declares a composite model identifier.",
    snippet: "id([$1])",
  },
  {
    name: "unique",
    description: "Requires the listed fields to be unique together.",
    snippet: "unique([$1])",
  },
  {
    name: "index",
    description: "Creates an index over the listed fields.",
    snippet: "index([$1])",
  },
  {
    name: "softDelete",
    description: "Enables relational soft deletion for this model.",
  },
];

export const DEFAULT_FUNCTION_DEFINITIONS = [
  {
    name: "uuid",
    description: "Generates a UUID string.",
    fieldTypes: ["String"],
  },
  {
    name: "cuid",
    description: "Generates a CUID string.",
    fieldTypes: ["String"],
  },
  {
    name: "now",
    description: "Uses the current date and time.",
    fieldTypes: ["DateTime"],
  },
] as const;
