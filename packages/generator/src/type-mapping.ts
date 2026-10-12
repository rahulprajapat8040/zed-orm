import type { ValidatedField } from "@zed-orm/schema";

/** Map a validated field to its TypeScript type expression. */
export function fieldToTsType(field: ValidatedField): string {
  let type: string;

  switch (field.typeKind) {
    case "scalar":
      type = scalarToTsType(field.typeName);
      break;
    case "enum":
      type = field.typeName;
      break;
    case "model":
      type = field.typeName;
      break;
    default:
      type = "unknown";
  }

  if (field.isList) {
    type = `readonly ${type}[]`;
  }

  if (field.isOptional) {
    type = `${type} | null`;
  }

  return type;
}

function scalarToTsType(typeName: string): string {
  switch (typeName) {
    case "String":
      return "string";
    case "Int":
    case "Float":
      return "number";
    case "BigInt":
      return "bigint";
    case "Decimal":
      return "string";
    case "Boolean":
      return "boolean";
    case "DateTime":
      return "Date";
    case "Json":
      return "unknown";
    case "Bytes":
      return "Uint8Array";
    default:
      return "unknown";
  }
}

/** Lowercase the first character for delegate property names (`User` -> `user`). */
export function toDelegateName(modelName: string): string {
  if (modelName.length === 0) {
    return modelName;
  }
  return modelName[0]!.toLowerCase() + modelName.slice(1);
}
