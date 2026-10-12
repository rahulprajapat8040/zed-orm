import * as vscode from "vscode";
import * as path from "node:path";
import {
  LanguageClient,
  State,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("Zed ORM", {
    log: true,
  });
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));
  const debug = vscode.workspace
    .getConfiguration("zedOrm")
    .get<boolean>("debug", false);

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: "zed", scheme: "file" },
      { language: "zed", scheme: "untitled" },
    ],
    synchronize: {
      fileEvents: [vscode.workspace.createFileSystemWatcher("**/*.zed")],
    },
    initializationOptions: { debug },
    outputChannel,
  };

  client = new LanguageClient(
    "zed-orm-vscode",
    "Zed ORM",
    serverOptions,
    clientOptions,
  );

  client.onDidChangeState((event) => {
    if (debug) {
      outputChannel.appendLine(`Language client state: ${event.newState}.`);
    }
  });
  void client.start().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(
      `Failed to start the Zed ORM language server: ${message}`,
    );
    void vscode.window.showErrorMessage(
      "Zed ORM language server failed to start. See the Zed ORM output channel for details.",
    );
  });
  context.subscriptions.push(client, outputChannel);
}

export function deactivate(): Promise<void> | undefined {
  if (
    client === undefined ||
    client.state === State.Stopped ||
    client.state === State.StartFailed
  ) {
    return undefined;
  }
  return client.stop();
}
