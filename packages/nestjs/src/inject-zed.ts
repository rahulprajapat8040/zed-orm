import { Inject } from "@nestjs/common";
import { ZED_CLIENT } from "./tokens.js";

/** Inject the Zed client registered by {@link ZedModule}. */
export function InjectZed(): ParameterDecorator {
  return Inject(ZED_CLIENT);
}
