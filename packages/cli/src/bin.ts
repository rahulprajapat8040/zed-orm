import { runCli } from "./index.js";

runCli()
  .then((code) => {
    if (code !== 0) {
      process.exitCode = code;
    }
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
