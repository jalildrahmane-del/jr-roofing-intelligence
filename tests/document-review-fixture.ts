import { DOCUMENT_CHECKLIST_VERSION, documentReviewItems } from "../src/document-review.ts";
export function reviewPayload(type="RAMS") {
  return {checklistVersion:DOCUMENT_CHECKLIST_VERSION,checks:Object.fromEntries(documentReviewItems(type).map(item=>[item.id,true]))};
}
export async function completeReview(form:any,id:string,note:string) {
  await form.getByLabel("Document to review",{exact:true}).selectOption(id);
  await form.getByRole("group").waitFor();
  await form.getByLabel("Review note",{exact:true}).fill(note);
  for (const checkbox of await form.getByRole("checkbox").all()) await checkbox.check();
}
