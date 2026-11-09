import "./load-env";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {and,eq,inArray,sql} from "drizzle-orm";
import {connectDatabase} from "../lib/db";
import * as s from "../lib/db/schema";
import {seed,DEMO_USER_ID} from "../lib/db/seed";
import {getEnv} from "../lib/env";
import {handleApi} from "../lib/http/api";
import {executeGroup} from "../lib/orchestrator/run";
import {parseFrontMatter} from "../lib/fixtures/load-fixture";
import type {ClaudeClient} from "../lib/harness/run-agent";
import {testSpendLedger} from "./spend-integration";
import {testApproval} from "./approval-integration";
import {testAuth} from "./auth-integration";
import {testInvariantChecks,testSameCaseConstraints} from "./security-integration";
import {createSpendLedger} from "../lib/db/spend-ledger";
const env=getEnv();
const url=env.DATABASE_URL;
if(!url||!new URL(url).pathname.endsWith("_test"))throw new Error("Integration requires an isolated DATABASE_URL ending _test");
const {db,pool}=connectDatabase(url);
let actor:{userId:string;role:string}|null={userId:DEMO_USER_ID,role:"clinician"};
const scheduled:string[]=[];
const integrationEnv={...env,AGENT_REPLAY:true,APP_ORIGIN:"http://localhost:3000"};
async function api(method:string,path:string,body?:unknown){
 return handleApi(new Request(`http://localhost:3000/api/${path}`,{method,headers:{"Content-Type":"application/json",Origin:"http://localhost:3000"},...(body===undefined?{}:{body:JSON.stringify(body)})}),path.split("/"),{db,session:async()=>actor,schedule:id=>scheduled.push(id),env:integrationEnv});
}
async function okay(method:string,path:string,body?:unknown){const response=await api(method,path,body);const data=await response.json();assert.equal(response.status,200,`${method} ${path}: ${JSON.stringify(data)}`);return data;}
function fakeClient(fail=false,counter={calls:0}):ClaudeClient{
 return {messages:{parse:async params=>{
  counter.calls++;
  if(fail)throw new Error("synthetic_failure_no_live_call");
  const system=JSON.stringify(params.system);
  // Select a stable literal source without asserting model prose.
  const rows=await db.select().from(s.documents).where(and(eq(s.documents.caseId,"UR-1042"),eq(s.documents.type,"progress_note")));
  const note=rows.find(row=>row.serviceDate==="2026-11-03")!;
  const quote=note.content.split("\n").find(line=>line.trim().length>30)!;
  let output:unknown;
  if(system.includes("Clinical Documentation agent"))output={facts:[{id:"f1",category:"symptoms",statement:quote,serviceDate:note.serviceDate,quotes:[{documentId:note.id,text:quote}]}],gaps:[]};
  else if(system.includes("Case Assembly and Drafting agent"))output={mode:"review_packet",sections:[{heading:"Current documentation",claims:[{text:quote,sourceKind:"extracted_fact",factIds:["f1"]}]}],openQuestions:[]};
  else output={checks:[{name:"support",result:"pass",detail:"Fixture source verified",affected:[]}],issues:[]};
  return {parsed_output:output,usage:{input_tokens:100,output_tokens:50},stop_reason:"end_turn"};
 }}};
}
async function runScheduled(fail=false){
 while(scheduled.length){
  const id=scheduled.shift()!,counter={calls:0};
  const options={client:fakeClient(fail,counter),env:{...integrationEnv,AGENT_REPLAY:false},replay:"off" as const,spend:{ledger:createSpendLedger(db),environment:"local" as const,agentRunRef:id}};
  if(fail){
   await executeGroup(db,id,options);
   assert.equal(counter.calls,2,"failed clinical call retries once before dependents are skipped");
  }else{
   await Promise.all([executeGroup(db,id,options),executeGroup(db,id,options)]);
   assert.equal(counter.calls,3,"duplicate execution must make one model call per agent only");
  }
 }
}
async function runningGroup(heartbeatAt:Date){
 const id=randomUUID(),now=new Date();
 await db.insert(s.runGroups).values({id,caseId:"UR-1042",status:"running",asOf:now,startedAt:now,heartbeatAt});
 await db.insert(s.agentRuns).values((["clinical_documentation","case_assembly_drafting","independent_quality"] as const).map(agent=>({id:randomUUID(),caseId:"UR-1042",runGroupId:id,agent,agentVersion:"pending",model:"none",inputHash:"pending",inputDocumentIds:[],status:"queued"})));
 return id;
}
const minutesAgo=(minutes:number)=>new Date(Date.now()-minutes*60000);
async function assertSwept(id:string,label:string){
 const [group]=await db.select().from(s.runGroups).where(eq(s.runGroups.id,id));assert.equal(group.status,"failed",label);
 const rows=await db.select().from(s.agentRuns).where(eq(s.agentRuns.runGroupId,id));
 assert.deepEqual(rows.map(row=>[row.status,row.errorKind]),Array(3).fill(["timed_out","stale"]),label);
 const events=await db.select().from(s.auditEvents).where(and(eq(s.auditEvents.action,"run_stale"),eq(s.auditEvents.objectId,id)));assert.equal(events.length,1,label);
 const [row]=await db.select().from(s.cases).where(eq(s.cases.id,"UR-1042"));assert.equal(row.status,"needs_review",label);
}
async function testStaleSweep(foreignUserId:string,approvalBody:unknown){
 const owner=actor;
 // Heartbeat younger than the limit is a live run, not a stale one.
 const live=await runningGroup(minutesAgo(9));
 assert.equal((await okay("GET",`runs/${live}`)).status,"running");
 await db.update(s.runGroups).set({heartbeatAt:minutesAgo(11)}).where(eq(s.runGroups.id,live));
 // Access is checked first: a foreign poll can neither read nor sweep the run.
 actor={userId:foreignUserId,role:"clinician"};
 assert.equal((await api("GET",`runs/${live}`)).status,404);
 actor=owner;
 const [untouched]=await db.select().from(s.runGroups).where(eq(s.runGroups.id,live));assert.equal(untouched.status,"running");
 assert.equal((await api("GET",`runs/${live}`)).status,200);await assertSwept(live,"GET run");
 for(const [label,request] of [["GET case",()=>api("GET","cases/UR-1042")],["GET validation",()=>api("GET","cases/UR-1042/validation")]] as const){
  const id=await runningGroup(minutesAgo(11));
  assert.equal((await request()).status,200,label);await assertSwept(id,label);
 }
 // Refused approval still commits the sweep.
 const refused=await runningGroup(minutesAgo(11));
 assert.equal((await api("POST","cases/UR-1042/approve",approvalBody)).status,409);await assertSwept(refused,"POST approve");
 // The swept run frees the one-active-run slot, and a worker finishing late cannot undo the sweep.
 const late=await runningGroup(new Date()),spendRef=`late-${late}`;
 const client:ClaudeClient={messages:{parse:async params=>{
  await db.update(s.runGroups).set({heartbeatAt:minutesAgo(11)}).where(eq(s.runGroups.id,late));
  await okay("GET",`runs/${late}`);
  return fakeClient().messages.parse(params);
 }}};
 const packets=await db.select({id:s.packetVersions.id}).from(s.packetVersions).where(eq(s.packetVersions.caseId,"UR-1042"));
 await executeGroup(db,late,{client,env:{...integrationEnv,AGENT_REPLAY:false},replay:"off",spend:{ledger:createSpendLedger(db),environment:"local",agentRunRef:spendRef}});
 await assertSwept(late,"late worker");
 assert.equal((await db.select({id:s.packetVersions.id}).from(s.packetVersions).where(eq(s.packetVersions.caseId,"UR-1042"))).length,packets.length,"late worker must not create a packet");
 const reservations=await db.select().from(s.spendReservations).where(eq(s.spendReservations.agentRunRef,spendRef));
 assert.deepEqual(reservations.map(row=>row.status),["settled"],"late worker still settles spend");
}
async function testFailedQuoteClears(approvalBody:{acknowledgement:string}){
 await db.delete(s.rateLimitCounters);
 const client:ClaudeClient={messages:{parse:async params=>{
  const system=JSON.stringify(params.system);
  const rows=await db.select().from(s.documents).where(and(eq(s.documents.caseId,"UR-1042"),eq(s.documents.type,"progress_note")));
  const note=rows.find(row=>row.serviceDate==="2026-11-03")!,quote=note.content.split("\n").find(line=>line.trim().length>30)!;
  let output:unknown;
  if(system.includes("Clinical Documentation agent"))output={facts:[{id:"f1",category:"symptoms",statement:quote,serviceDate:note.serviceDate,quotes:[{documentId:note.id,text:quote}]},{id:"f2",category:"symptoms",statement:"Synthetic unsupported fact",serviceDate:note.serviceDate,quotes:[{documentId:note.id,text:"An invented statement absent from this record."}]}],gaps:[]};
  else if(system.includes("Case Assembly and Drafting agent"))output={mode:"review_packet",sections:[{heading:"Current documentation",claims:[{text:quote,sourceKind:"extracted_fact",factIds:["f1"]},{text:"Synthetic unsupported claim",sourceKind:"extracted_fact",factIds:["f2"]}]}],openQuestions:[]};
  else output={checks:[{name:"model_no_claims",result:"fail",detail:"Finding with no claim",affected:[]},{name:"model_named_claim",result:"fail",detail:"Finding on claim 2",affected:["claim-2","claim-unknown"]}],issues:[{type:"missing_document",severity:"major",blocking:true,description:"Synthetic: no discharge plan",requiredDocumentType:null,serviceDate:null,sendBackTo:null}]};
  return {parsed_output:output,usage:{input_tokens:100,output_tokens:50},stop_reason:"end_turn"};
 }}};
 const run=await okay("POST","cases/UR-1042/runs",{});scheduled.length=0;
 await executeGroup(db,run.runGroupId,{client,env:{...integrationEnv,AGENT_REPLAY:false},replay:"off",spend:{ledger:createSpendLedger(db),environment:"local",agentRunRef:run.runGroupId}});
 assert.equal((await okay("GET",`runs/${run.runGroupId}`)).status,"complete");
 const issues=await okay("GET","cases/UR-1042/issues"),finding=issues.find((issue:{description:string})=>issue.description==="Synthetic: no discharge plan");
 assert.equal(finding.blocking,false,"a model issue stays visible but never blocks, even when the model asks");
 let validation=await okay("GET","cases/UR-1042/validation");
 const codes=()=>validation.blockers.map((b:{code:string;objectId?:string})=>b.code+":"+(b.objectId??"")).sort();
 const claimRows=await okay("GET","cases/UR-1042/claims"),bad=claimRows.find((claim:{status:string})=>claim.status==="unsupported"),good=claimRows.find((claim:{status:string})=>claim.status==="source_verified");
 assert.deepEqual(codes(),["unsupported_material_claim:"+bad.id,"validation_failed:model_named_claim","validation_failed:quote_support"].sort(),"failures name the claim; a finding with no claim does not block");
 const stored=validation.report.checks.find((check:{name:string})=>check.name==="quote_support");assert.deepEqual(stored.affected,[bad.id]);
 assert.equal((await api("POST","cases/UR-1042/approve",{...approvalBody,packetVersionId:validation.packetVersionId,contentHash:validation.contentHash})).status,409);
 await okay("PATCH",`claims/${bad.id}`,{status:"rejected"});
 validation=await okay("GET","cases/UR-1042/validation");assert.deepEqual(validation.blockers,[],"rejecting the affected claim clears both failed checks");
 const approved=await okay("POST","cases/UR-1042/approve",{...approvalBody,packetVersionId:validation.packetVersionId,contentHash:validation.contentHash});assert.equal(approved.status,"valid");
 // Editing an approved packet clones claims under new IDs; the rejection must still count.
 await okay("PATCH",`claims/${good.id}`,{text:"Clinician reviewed the documented symptoms again."});
 validation=await okay("GET","cases/UR-1042/validation");assert.deepEqual(validation.blockers,[],"a cloned packet keeps the clinician's rejection");
 assert.notEqual(validation.packetVersionId,approved.packetVersionId);
 await okay("POST","cases/UR-1042/approve",{...approvalBody,packetVersionId:validation.packetVersionId,contentHash:validation.contentHash});
}
// Rule 8: citing a period ID earns nothing. Only code's own period claims skip the quote requirement.
async function testPeriodClaims(approvalBody:{acknowledgement:string}){
 await db.delete(s.rateLimitCounters);
 const hostile="Patient may be discharged on 2026-11-03.";
 const client:ClaudeClient={messages:{parse:async params=>{
  const system=JSON.stringify(params.system);
  const rows=await db.select().from(s.documents).where(and(eq(s.documents.caseId,"UR-1042"),eq(s.documents.type,"progress_note")));
  const note=rows.find(row=>row.serviceDate==="2026-11-03")!,quote=note.content.split("\n").find(line=>line.trim().length>30)!;
  let output:unknown;
  // The second fact takes a reserved period ID with a real quote, so a verified-set check alone would pass it.
  if(system.includes("Clinical Documentation agent"))output={facts:[{id:"f1",category:"symptoms",statement:quote,serviceDate:note.serviceDate,quotes:[{documentId:note.id,text:quote}]},{id:"period-requested",category:"symptoms",statement:quote,serviceDate:note.serviceDate,quotes:[{documentId:note.id,text:quote}]}],gaps:[]};
  else if(system.includes("Case Assembly and Drafting agent"))output={mode:"review_packet",sections:[{heading:"Current documentation",claims:[{text:quote,sourceKind:"extracted_fact",factIds:["f1"]},{text:hostile,sourceKind:"extracted_fact",factIds:["period-authorized"]},{text:hostile+" Named.",sourceKind:"extracted_fact",factIds:["period-requested"]}]}],openQuestions:[]};
  else output={checks:[],issues:[]};
  return {parsed_output:output,usage:{input_tokens:100,output_tokens:50},stop_reason:"end_turn"};
 }}};
 const run=await okay("POST","cases/UR-1042/runs",{});scheduled.length=0;
 await executeGroup(db,run.runGroupId,{client,env:{...integrationEnv,AGENT_REPLAY:false},replay:"off",spend:{ledger:createSpendLedger(db),environment:"local",agentRunRef:run.runGroupId}});
 assert.equal((await okay("GET",`runs/${run.runGroupId}`)).status,"complete");
 const claimRows=await okay("GET","cases/UR-1042/claims") as {id:string;text:string;status:string;type:string;author:string}[];
 const drafted=claimRows.filter(claim=>claim.text.startsWith(hostile));
 assert.deepEqual(drafted.map(claim=>claim.status),["unsupported","unsupported"],"a drafted claim citing a period ID is unsupported");
 const periods=claimRows.filter(claim=>claim.author==="code");
 assert.deepEqual(periods.map(({text,status,type})=>({text,status,type})).sort((a,b)=>a.text<b.text?-1:1),[
  {text:"Authorized period: 2026-11-01 through 2026-11-03.",status:"source_verified",type:"administrative_fact"},
  {text:"Requested period: 2026-11-04 through 2026-11-06.",status:"source_verified",type:"administrative_fact"},
 ],"code states both periods from stored values");
 const links=await db.select({claimId:s.claimEvidence.claimId}).from(s.claimEvidence).where(inArray(s.claimEvidence.claimId,periods.map(claim=>claim.id)));
 assert.deepEqual(links,[],"a model quote never attaches to a code period claim");
 let validation=await okay("GET","cases/UR-1042/validation");
 assert.deepEqual(validation.blockers.map((b:{code:string;objectId?:string})=>b.code+":"+(b.objectId??"")).sort(),drafted.map(claim=>"unsupported_material_claim:"+claim.id).sort(),"only the drafted claims block; code claims pass the evidence check");
 assert.equal((await api("POST","cases/UR-1042/approve",{...approvalBody,packetVersionId:validation.packetVersionId,contentHash:validation.contentHash})).status,409);
 for(const claim of drafted)await okay("PATCH",`claims/${claim.id}`,{status:"rejected"});
 validation=await okay("GET","cases/UR-1042/validation");assert.deepEqual(validation.blockers,[],"rejecting the drafted claims clears the packet");
 assert.equal((await okay("POST","cases/UR-1042/approve",{...approvalBody,packetVersionId:validation.packetVersionId,contentHash:validation.contentHash})).status,"valid");
 // Code's two period claims alone are not a packet a clinician can approve.
 const remaining=claimRows.find(claim=>claim.status==="source_verified"&&claim.author!=="code")!;
 await okay("PATCH",`claims/${remaining.id}`,{status:"rejected"});
 validation=await okay("GET","cases/UR-1042/validation");
 assert.deepEqual(validation.blockers.map((b:{code:string;objectId?:string})=>b.code+":"+(b.objectId??"")),["validation_failed:packet_integrity"],"a packet of only period claims cannot be approved");
}
async function main(){
 await seed(db);await seed(db);
 const [initial]=await db.select({count:sql<number>`count(*)::int`}).from(s.documents).where(eq(s.documents.caseId,"UR-1042"));assert.equal(initial.count,7,"fresh test database required");
 assert.equal((await okay("GET","cases")).length,1);
 actor=null;assert.equal((await api("GET","cases")).status,401);actor={userId:DEMO_USER_ID,role:"clinician"};
 // House rule 1: an open model finding on the same key must not stop code raising the blocking issue.
 await db.update(s.issues).set({severity:"minor",blocking:false,source:"independent_quality",description:"Model finding: note absent"}).where(and(eq(s.issues.caseId,"UR-1042"),eq(s.issues.dedupeKey,"missing_document:progress_note:2026-11-02")));
 const first=await okay("POST","cases/UR-1042/runs",{});
 assert.equal((await api("POST","cases/UR-1042/runs",{})).status,409);
 await runScheduled();
 let status=await okay("GET",`runs/${first.runGroupId}`);assert.equal(status.status,"complete",JSON.stringify(status));assert.equal(status.agents.length,3);
 const raised=(await okay("GET","cases/UR-1042/issues")).filter((issue:{requiredServiceDate:string|null})=>issue.requiredServiceDate==="2026-11-02");
 assert.deepEqual(raised.map(({blocking,source,severity,description}:{blocking:boolean;source:string;severity:string;description:string})=>({blocking,source,severity,description})),[{blocking:true,source:"code",severity:"critical",description:"Progress note for 2026-11-02 is missing"}],"code takes over an open model finding on its key");
 let validation=await okay("GET","cases/UR-1042/validation");assert(validation.blockers.some((b:{code:string})=>b.code==="date_coverage_gap"));
 assert.equal((await api("POST","cases/UR-1042/approve",{packetVersionId:validation.packetVersionId,contentHash:validation.contentHash,acknowledgement:"Reviewed synthetic record"})).status,409);
 const raw=await readFile("fixtures/ur-1042/late-arrival/note-2026-11-02.md","utf8"),note=parseFrontMatter(raw);
 assert.equal((await api("POST","cases/UR-1042/documents",{type:"policy",title:"attempt",content:note.body})).status,422);
 const uploaded=await okay("POST","cases/UR-1042/documents",{type:"progress_note",title:"Caller title ignored",author:"Caller ignored",serviceDate:"2026-11-01",content:note.body});
 assert.equal(uploaded.verificationState,"unverified");assert.equal(uploaded.serviceDate,"2026-11-02");
 const issues=await okay("GET","cases/UR-1042/issues");
 const missing=issues.find((issue:{type:string})=>issue.type==="missing_document"),dates=issues.find((issue:{type:string})=>issue.type==="date_conflict");
 assert.equal((await api("POST",`issues/${missing.id}/resolve`,{resolution:"attach_document",reason:"Source checked",evidenceDocumentId:uploaded.id})).status,422);
 const verified=await okay("POST",`documents/${uploaded.id}/verify`,{decision:"verified"});assert.equal(verified.rerun,"started");
 await runScheduled();
 await okay("POST",`issues/${missing.id}/resolve`,{resolution:"attach_document",reason:"Verified late note covers missing day",evidenceDocumentId:uploaded.id});
 const caseView=await okay("GET","cases/UR-1042");
 await okay("POST",`issues/${dates.id}/resolve`,{resolution:"verify_period",reason:"Request is for Nov4–6; current authorization remains Nov1–3",evidenceDocumentId:caseView.reviewPeriod.sourceDocumentId,verifiedPeriod:{start:"2026-11-04",end:"2026-11-06"}});
 validation=await okay("GET","cases/UR-1042/validation");assert.deepEqual(validation.blockers,[],JSON.stringify(validation));
 const approvalBody={packetVersionId:validation.packetVersionId,contentHash:validation.contentHash,acknowledgement:"Reviewed all sources in synthetic demo"};
 const approvals=await Promise.all([okay("POST","cases/UR-1042/approve",approvalBody),okay("POST","cases/UR-1042/approve",approvalBody)]);assert.equal(approvals[0].id,approvals[1].id);
 const before=(await okay("GET","cases/UR-1042")).latestPacketVersion;
 await okay("POST","cases/UR-1042/runs",{});await runScheduled();
 const after=(await okay("GET","cases/UR-1042")).latestPacketVersion;assert.equal(after.id,before.id,"identical rerun must reuse packet");
 const [approvalRow]=await db.select().from(s.approvals).where(eq(s.approvals.id,approvals[0].id));assert.equal(approvalRow.status,"valid","identical rerun must preserve approval");
 const claimRows=await okay("GET","cases/UR-1042/claims");
 await okay("PATCH",`claims/${claimRows[0].id}`,{text:"Clinician reviewed the documented symptoms."});
 const changed=(await okay("GET","cases/UR-1042")).latestPacketVersion;assert.notEqual(changed.id,before.id);
 const [invalidated]=await db.select().from(s.approvals).where(eq(s.approvals.id,approvals[0].id));assert.equal(invalidated.status,"invalidated");
 // A document received after the run cancels the sign-off and blocks a new one until a run reads it.
 validation=await okay("GET","cases/UR-1042/validation");assert.deepEqual(validation.blockers,[],JSON.stringify(validation));
 const signedOff=await okay("POST","cases/UR-1042/approve",{...approvalBody,packetVersionId:validation.packetVersionId,contentHash:validation.contentHash});assert.equal(signedOff.status,"valid");
 const lateCopy=await okay("POST","cases/UR-1042/documents",{type:"progress_note",title:"Duplicate",content:note.body});
 const [cancelled]=await db.select().from(s.approvals).where(eq(s.approvals.id,signedOff.id));assert.equal(cancelled.status,"invalidated","a newer source cancels the sign-off");
 assert.notEqual((await okay("GET","cases/UR-1042")).status,"approved_for_submission");
 validation=await okay("GET","cases/UR-1042/validation");
 assert(validation.blockers.some((b:{code:string;objectId?:string})=>b.code==="run_incomplete"&&b.objectId===lateCopy.id),JSON.stringify(validation.blockers));
 assert.equal((await api("POST","cases/UR-1042/approve",{...approvalBody,packetVersionId:validation.packetVersionId,contentHash:validation.contentHash})).status,409);
 const foreign=randomUUID();await db.insert(s.users).values({id:foreign,accountKey:`test-${foreign}`,email:`${foreign}@example.test`,name:"Test Clinician",role:"clinician"});actor={userId:foreign,role:"clinician"};
 for(const [method,path,body] of [["GET","cases/UR-1042"],["GET","cases/UR-1042/documents"],["GET","cases/UR-1042/claims"],["GET","cases/UR-1042/issues"],["GET","cases/UR-1042/validation"],["GET",`documents/${uploaded.id}`],["GET",`runs/${first.runGroupId}`],["POST",`documents/${uploaded.id}/verify`,{decision:"verified"}],["PATCH",`claims/${claimRows[0].id}`,{text:"probe"}],["POST",`issues/${missing.id}/resolve`,{resolution:"attach_document",reason:"probe",evidenceDocumentId:uploaded.id}],["POST","cases/UR-1042/runs",{}],["POST","cases/UR-1042/approve",approvalBody]] as const){const response=await api(method,path,body);assert.equal(response.status,404,`${method} ${path}`);}
 assert.deepEqual(await okay("GET","cases"),[]);actor={userId:DEMO_USER_ID,role:"clinician"};
 await okay("POST","cases/UR-1042/runs",{});await runScheduled(true);
 const [failedGroup]=await db.select().from(s.runGroups).where(eq(s.runGroups.caseId,"UR-1042")).orderBy(sql`${s.runGroups.startedAt} desc`).limit(1);
 status=await okay("GET",`runs/${failedGroup.id}`);assert.equal(status.status,"failed");assert.deepEqual(status.agents.map((row:{status:string})=>row.status).sort(),["failed","skipped","skipped"]);
 validation=await okay("GET","cases/UR-1042/validation");assert(validation.blockers.some((b:{code:string})=>b.code==="run_incomplete"));
 await testStaleSweep(foreign,approvalBody);
 await testFailedQuoteClears(approvalBody);
 await testPeriodClaims(approvalBody);
 await assert.rejects(db.update(s.auditEvents).set({action:"tamper"}),/Failed query/);
 await db.transaction(async tx=>{await tx.execute(sql`SET LOCAL ROLE app_rw`);await tx.select().from(s.documents).limit(1);});
 await assert.rejects(db.transaction(async tx=>{await tx.execute(sql`SET LOCAL ROLE app_rw`);await tx.update(s.documents).set({content:"tamper"}).where(eq(s.documents.id,uploaded.id));}));
 await assert.rejects(db.transaction(async tx=>{await tx.execute(sql`SET LOCAL ROLE app_rw`);await tx.delete(s.auditEvents);}));
 await testInvariantChecks(db);await testSameCaseConstraints(db);
 await testSpendLedger(db);await testApproval(db);await testAuth(db);
 console.log(JSON.stringify({status:"passed",mode:"fake-client + real PostgreSQL",liveModelCalls:0,checks:["idempotent seed","full UR-1042 flow","source-linked approval","concurrent approval","newer source cancels and blocks sign-off","identical rerun","duplicate execution","immutable history","cross-case routes","failed run skips","stale sweep on poll, case read, gate and approval","late worker cannot undo sweep","failed quote clears only by clinician action","period IDs verify nothing","period claims written by code","model issues never block","model finding cannot suppress a code blocker","audit trigger","document grants","invariant checks","same-case foreign keys","spend concurrency","auth throttle"]},null,2));
}
main().finally(()=>pool.end());
