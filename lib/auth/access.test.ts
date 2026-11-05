import { describe, expect, it } from "vitest";
import { ACTIONS, checkRole, checkCaseAccess, listScopeFor } from "./access";
const expected = {
  clinician: ["list_cases", "read_case", "read_audit", "upload_document", "verify_document", "start_run", "edit_claim", "resolve_issue", "approve", "read_packet"],
  coordinator: ["list_cases", "read_case", "upload_document"],
  supervisor: ["list_cases", "read_case", "read_audit", "assign_case"],
  packet_staff: ["list_cases", "read_packet"],
};
describe("role permissions and case boundaries", () => {
  it.each(Object.entries(expected))("pins the allowed actions for %s", (role, allowed) => {
    for (const action of ACTIONS) expect(checkRole({userId:"u-a",role}, action)).toEqual(allowed.includes(action) ? {allowed:true} : {allowed:false,status:403});
  });
  it.each(ACTIONS)("denies missing sessions and unknown roles for %s", action => {
    for (const session of [null,{userId:" ",role:"clinician"}]) expect(checkRole(session,action)).toEqual({allowed:false,status:401});
    for (const role of ["admin","Clinician",""]) expect(checkRole({userId:"u-a",role},action)).toEqual({allowed:false,status:403});
  });
  it("does not let membership grant another clinician access", () => {
    expect(checkCaseAccess({userId:"u-b",role:"clinician"},"read_case",{assignedTo:"u-a",member:true})).toEqual({allowed:false,status:404});
    expect(checkCaseAccess({userId:"u-a",role:"clinician"},"approve",{assignedTo:"u-a"})).toEqual({allowed:true});
  });
  it.each(["coordinator","supervisor","packet_staff"])("requires explicit case membership for %s", role => {
    const action = role === "packet_staff" ? "read_packet" : "read_case";
    for (const record of [null,{assignedTo:"u-a"},{assignedTo:"u-a",member:false}]) expect(checkCaseAccess({userId:"u-b",role},action,record)).toEqual({allowed:false,status:404});
    expect(checkCaseAccess({userId:"u-b",role},action,{assignedTo:"u-a",member:true})).toEqual({allowed:true});
    expect(checkCaseAccess({userId:"u-b",role},"approve",{assignedTo:"u-b",member:true})).toEqual({allowed:false,status:403});
  });
  it.each(["delete_case","constructor","__proto__",""])("denies unknown action %s", action => {
    expect(checkRole({userId:"u-a",role:"clinician"},action)).toEqual({allowed:false,status:403});
  });
  it("retains the clinician assignment helper without misrepresenting staff scopes", () => {
    expect(listScopeFor({userId:"u-a",role:"clinician"})).toEqual({assignedTo:"u-a"});
    expect(() => listScopeFor({userId:"u-a",role:"coordinator"})).toThrow("access_denied");
  });
});