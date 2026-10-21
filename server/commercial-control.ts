import type {Store} from "./store.ts";
import type {User} from "../src/model.ts";
import {text} from "../src/model.ts";

function pence(value:unknown,label:string):number {
  if(typeof value!=="number" || !Number.isSafeInteger(value) || value<0 || value>100_000_000_000)
    throw Error(label+" must be a non-negative integer number of pence");
  return value;
}
export function saveCommercial(store:Store,user:User,pid:string,action:string,d:any) {
  if(user.role!=="manager") throw Error("Forbidden: commercial manager required");
  if(!d||typeof d!=="object"||Array.isArray(d)) throw Error("Commercial record required");
  if(!store.snapshot(user).projects.some(p=>p.id===pid)) throw Error("Project not found");
  return store.transaction(()=>{
    if(action==="budget") return store.append(user,pid,"commercial.budget",{
      amountPence:pence(d.amountPence,"Budget"),reference:text(d.reference,"Budget approval reference",300),
      note:text(d.note,"Budget basis and exclusions",2000),
      status:"recorded budget reference; approval must be independently evidenced",
    });
    if(action==="cost") {
      if(!["commitment","actual"].includes(d.costType)) throw Error("Invalid cost category");
      return store.append(user,pid,"commercial.cost",{
        costType:d.costType,amountPence:pence(d.amountPence,"Cost"),
        reference:text(d.reference,"Order or invoice reference",300),
        description:text(d.description,"Cost description",2000),
        note:"Cost record only, not a payment approval",
      });
    }
    if(action==="variation") {
      if(!["proposed","accepted","rejected"].includes(d.status)) throw Error("Invalid variation status");
      const reference=text(d.reference,"Variation reference",200);
      const prior=d.entityId ? store.db.prepare("SELECT * FROM records WHERE id=? AND pid=? AND kind='commercial.variation'").get(d.entityId,pid) as any : null;
      if(d.entityId && !prior) throw Error("Original variation not found in this project");
      const entityId=prior ? (JSON.parse(prior.data).entityId||prior.id) : undefined;
      if(d.status!=="proposed" && !text(d.decisionReference,"Written client decision reference",500))
        throw Error("Written decision reference required");
      const data={
        entityId,reference,description:text(d.description,"Variation description",2000),
        amountPence:d.amountPence===null?null:pence(d.amountPence,"Variation amount"),
        status:d.status,decisionReference:d.status==="proposed"?"":text(d.decisionReference,"Written client decision reference",500),
        note:"Recorded status based on supplied reference; not independent verification of client acceptance",
      };
      const saved=store.append(user,pid,"commercial.variation",data);
      if(!entityId) {
        // The record ID itself is the stable entity key for its first revision.
      }
      return saved;
    }
    throw Error("Unsupported commercial action");
  });
}
