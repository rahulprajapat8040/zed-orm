import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import {
  CompletionRequest,
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
  InitializeRequest,
  InitializedNotification,
  ProposedFeatures,
  createConnection as createLspConnection,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
  analyzeSchemaSource,
  computeCompletionItems,
  createLanguageServer,
  getSemanticTokensLegend,
} from "./index.js";

describe("@zed-orm/language-server", () => {
  it("surfaces parse diagnostics for invalid schema input", () => {
    const document = TextDocument.create(
      "file:///schema.zed",
      "zed",
      1,
      `model User {\n  id String\n`,
    );

    const result = analyzeSchemaSource(document.getText(), document.uri);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("provides top-level schema completions", () => {
    const document = TextDocument.create(
      "file:///schema.zed",
      "zed",
      1,
      "model User {\n  id String\n}\n\n",
    );

    const completions = computeCompletionItems(document, {
      line: 0,
      character: 0,
    });
    expect(completions.some((item) => item.label === "model")).toBe(true);
    expect(completions.some((item) => item.label === "String")).toBe(false);
  });

  it("exposes a semantic token legend", () => {
    const legend = getSemanticTokensLegend();
    expect(legend.tokenTypes.includes("class")).toBe(true);
    expect(legend.tokenModifiers.includes("declaration")).toBe(true);
  });

  it("serves context-aware completions through the LSP completion request", async () => {
    const lsp = await startLspClient();
    try {
      expect(lsp.triggerCharacters).toEqual(["@", ".", ":", "(", ",", "["]);

      const fieldItems = await lsp.complete(`model User {\n  id String @|\n}`);
      const fieldLabels = fieldItems.map((item) => item.label);
      expect(fieldLabels).toContain("@id");
      expect(fieldLabels).toContain("@default");
      expect(fieldLabels).not.toContain("@@index");
      expect(fieldLabels).not.toContain("@map");

      const blockItems = await lsp.complete(
        `model User {\n  id String @id\n  @@|\n}`,
      );
      const blockLabels = blockItems.map((item) => item.label);
      expect(blockLabels).toContain("@@index");
      expect(blockLabels).toContain("@@unique");
      expect(blockLabels).not.toContain("@id");
      expect(blockLabels).not.toContain("@@map");

      const stringDefaults = await lsp.complete(
        `model User {\n  id String @id\n  key String @default(|)\n}`,
      );
      const stringLabels = stringDefaults.map((item) => item.label);
      expect(stringLabels).toContain("uuid()");
      expect(stringLabels).toContain("cuid()");
      expect(stringLabels).not.toContain("now()");

      const dateDefaults = await lsp.complete(
        `model User {\n  id String @id\n  createdAt DateTime @default(|)\n}`,
      );
      expect(dateDefaults.map((item) => item.label)).toContain("now()");
      expect(dateDefaults.map((item) => item.label)).not.toContain("uuid()");

      const numberDefaults = await lsp.complete(
        `model User {\n  id String @id\n  age Int @default(|)\n}`,
      );
      expect(numberDefaults.map((item) => item.label)).toEqual(["0"]);

      const relationArgs = await lsp.complete(
        `model User {\n  id String @id\n  posts Post[]\n}\nmodel Post {\n  id String @id\n  userId String\n  user User @relation(|)\n}`,
      );
      const relationLabels = relationArgs.map((item) => item.label);
      expect(relationLabels).toContain("fields:");
      expect(relationLabels).toContain("references:");
      expect(relationLabels).toContain("onSoftDelete:");
      expect(relationLabels).not.toContain("onDelete:");

      const localFields = await lsp.complete(
        `model User {\n  id String @id\n  posts Post[]\n}\nmodel Post {\n  id String @id\n  userId String\n  user User @relation(fields: [|], references: [id])\n}`,
      );
      expect(localFields.map((item) => item.label)).toContain("userId");
      expect(localFields.map((item) => item.label)).not.toContain("posts");
      expect(localFields.map((item) => item.label)).not.toContain("user");
      expect(
        localFields.find((item) => item.label === "userId")?.textEdit,
      ).toMatchObject({ newText: "userId" });

      const referencedFields = await lsp.complete(
        `model User {\n  id String @id\n  email String\n  posts Post[]\n}\nmodel Post {\n  id String @id\n  userId String\n  user User @relation(fields: [userId], references: [|])\n}`,
      );
      expect(referencedFields.map((item) => item.label)).toContain("email");
      expect(referencedFields.map((item) => item.label)).not.toContain(
        "userId",
      );
      expect(referencedFields.map((item) => item.label)).not.toContain("posts");

      const blockFields = await lsp.complete(
        `model User {\n  id String @id\n  @@index([|])\n}`,
      );
      expect(
        blockFields.find((item) => item.label === "id")?.textEdit,
      ).toMatchObject({ newText: "id" });

      const noDuplicateParen = await lsp.complete(
        `model User {\n  id String @id\n  key String @def|ault(\n}`,
      );
      expect(
        noDuplicateParen.find((item) => item.label === "@default")?.textEdit,
      ).toMatchObject({ newText: "default" });

      const noDuplicateBlockParen = await lsp.complete(
        `model User {\n  id String @id\n  @@in|dex(\n}`,
      );
      expect(
        noDuplicateBlockParen.find((item) => item.label === "@@index")
          ?.textEdit,
      ).toMatchObject({ newText: "index" });

      const incomplete = await lsp.complete(
        `model User {\n  id String @default(\n`,
      );
      expect(incomplete.map((item) => item.label)).toContain("uuid()");
    } finally {
      lsp.dispose();
    }
  });

  it("updates completions after synchronized document changes", async () => {
    const lsp = await startLspClient();
    try {
      const textDocument = {
        uri: "file:///update-completion.zed",
        languageId: "zed",
        version: 1,
      };
      const initialText =
        "model User {\n id String @id\n related String @\n}\nmodel Profile {\n id String @id\n}";
      lsp.client.sendNotification(DidOpenTextDocumentNotification.type, {
        textDocument: {
          ...textDocument,
          text: initialText,
        },
      });
      const before = await lsp.completeAt(textDocument.uri, 2, 17);
      expect(before.map((item) => item.label)).not.toContain("@relation");

      lsp.client.sendNotification(DidChangeTextDocumentNotification.type, {
        textDocument: { uri: textDocument.uri, version: 2 },
        contentChanges: [
          {
            text: "model User {\n id String @id\n related Profile @\n}\nmodel Profile {\n id String @id\n}",
          },
        ],
      });
      const after = await lsp.completeAt(textDocument.uri, 2, 18);
      expect(after.map((item) => item.label)).toContain("@relation");
    } finally {
      lsp.dispose();
    }
  });

  it("does not offer schema completions inside comments or strings", async () => {
    const lsp = await startLspClient();
    try {
      expect(
        await lsp.complete(`model User {\n id String @id\n // @|\n}`),
      ).toEqual([]);
      expect(
        await lsp.complete(
          `model User {\n id String @id\n value String @default("@|")\n}`,
        ),
      ).toEqual([]);
    } finally {
      lsp.dispose();
    }
  });
});

async function startLspClient() {
  const clientToServer = new PassThrough();
  const serverToClient = new PassThrough();
  const server = createLanguageServer(
    createLspConnection(clientToServer, serverToClient, ProposedFeatures.all),
  );
  const client = createLspConnection(
    serverToClient,
    clientToServer,
    ProposedFeatures.all,
  );
  server.listen();
  client.listen();

  const initializeResult = await client.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
  });
  client.sendNotification(InitializedNotification.type, {});
  let sequence = 0;

  return {
    client,
    triggerCharacters:
      initializeResult.capabilities.completionProvider &&
      "triggerCharacters" in initializeResult.capabilities.completionProvider
        ? initializeResult.capabilities.completionProvider.triggerCharacters
        : [],
    async complete(markedText: string) {
      const cursorOffset = markedText.indexOf("|");
      const source = markedText.replace("|", "");
      const uri = `file:///completion-${sequence++}.zed`;
      client.sendNotification(DidOpenTextDocumentNotification.type, {
        textDocument: { uri, languageId: "zed", version: 1, text: source },
      });
      const beforeCursor = source.slice(0, cursorOffset);
      const line = beforeCursor.split("\n").length - 1;
      const character =
        beforeCursor.length - (beforeCursor.lastIndexOf("\n") + 1);
      return this.completeAt(uri, line, character);
    },
    async completeAt(uri: string, line: number, character: number) {
      const result = await client.sendRequest(CompletionRequest.type, {
        textDocument: { uri },
        position: { line, character },
      });
      return Array.isArray(result) ? result : result.items;
    },
    dispose() {
      client.dispose();
      server.dispose();
    },
  };
}
