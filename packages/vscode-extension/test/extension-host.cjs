const assert = require("node:assert/strict");
const vscode = require("vscode");

async function getCompletionLabels(documentText, marker) {
  const offset = documentText.indexOf(marker);
  assert.notEqual(offset, -1, `Missing cursor marker: ${marker}`);
  const text = documentText.slice(0, offset) + documentText.slice(offset + 1);
  const document = await vscode.workspace.openTextDocument({
    language: "zed",
    content: text,
  });
  await vscode.window.showTextDocument(document);

  let labels = [];
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      document.uri,
      document.positionAt(offset),
    );
    const items = Array.isArray(result) ? result : (result?.items ?? []);
    labels = items.map((item) =>
      typeof item.label === "string" ? item.label : item.label.label,
    );
    if (labels.length > 0) {
      return labels;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return labels;
}

async function run() {
  const extension = vscode.extensions.getExtension("zed-orm.zed-orm-vscode");
  assert.ok(extension, "Packaged Zed ORM extension did not load.");
  await extension.activate();

  const fieldLabels = await getCompletionLabels(
    "model User {\n  id String @|\n}",
    "|",
  );
  assert.ok(
    fieldLabels.includes("@id"),
    "VS Code did not show @id completion.",
  );
  assert.ok(
    fieldLabels.includes("@default"),
    "VS Code did not show @default completion.",
  );

  const blockLabels = await getCompletionLabels(
    "model User {\n  id String @id\n  @@|\n}",
    "|",
  );
  assert.ok(
    blockLabels.includes("@@index"),
    "VS Code did not show @@index completion.",
  );

  const defaultLabels = await getCompletionLabels(
    "model User {\n  id String @id\n  key String @default(|)\n}",
    "|",
  );
  assert.ok(
    defaultLabels.includes("uuid()"),
    "VS Code did not show the String uuid() default completion.",
  );
  console.log("Zed ORM Extension Host completion assertions passed.");
}

module.exports = { run };
