import { BlockNoteSchema, createCodeBlockSpec } from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";
import { createEmbedBlock } from "./embed-block";

/**
 * Schéma de l'éditeur = schéma par défaut de BlockNote (les documents existants se chargent tels quels)
 * + bloc « embed » + bloc de code avec la liste de langages de @blocknote/code-block (même prop `language`).
 */
export function createEditorSchema(peertubeHosts: string[]) {
  return BlockNoteSchema.create().extend({
    blockSpecs: {
      codeBlock: createCodeBlockSpec({ ...codeBlockOptions, defaultLanguage: "text" }),
      embed: createEmbedBlock(peertubeHosts),
    },
  });
}

export type EditorSchema = ReturnType<typeof createEditorSchema>;
export type EditorInstance = EditorSchema["BlockNoteEditor"];
export type EditorPartialBlock = EditorSchema["PartialBlock"];
