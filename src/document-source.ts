import type { RecordItem } from "./model.ts";

export function documentSourceText(source: RecordItem): string {
  return source.kind === "intelligence.source"
    ? source.data.content
    : JSON.stringify(source.data);
}
