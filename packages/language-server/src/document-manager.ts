import type { TextDocument } from "vscode-languageserver-textdocument";

export class DocumentManager {
  private readonly documents = new Map<string, TextDocument>();

  open(document: TextDocument): void {
    this.documents.set(document.uri, document);
  }

  update(document: TextDocument): void {
    this.documents.set(document.uri, document);
  }

  close(uri: string): void {
    this.documents.delete(uri);
  }

  get(uri: string): TextDocument | undefined {
    return this.documents.get(uri);
  }

  entries(): readonly TextDocument[] {
    return Array.from(this.documents.values());
  }
}

export const createDocumentManager = (): DocumentManager => new DocumentManager();
