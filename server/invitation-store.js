import crypto from "node:crypto";

export const versionOf = invitation => invitation.data?._rev || "legacy";

export class EditConflict extends Error {
  constructor(version) {
    super("Приглашение изменилось в другой вкладке. Сохраните свой черновик и загрузите актуальную версию.");
    this.status = 409;
    this.code = "EDIT_CONFLICT";
    this.version = version;
  }
}

// The revision condition belongs to the UPDATE itself. A stale request cannot
// overwrite a newer password, closure setting or document, even across servers.
export async function updateInvitation(sb, invitation, data, fields = {}) {
  const previous = invitation.data?._rev;
  const condition = previous ? `eq.${encodeURIComponent(previous)}` : "is.null";
  const version = crypto.randomBytes(16).toString("hex");
  const rows = await sb(`/shq_invitations?id=eq.${invitation.id}&data->>_rev=${condition}&select=id`, {
    method: "PATCH",
    body: {...fields, data: {...data, _rev: version}},
    prefer: "return=representation",
  });
  if (!Array.isArray(rows) || rows.length !== 1) throw new EditConflict();
  return version;
}

export function assertVersion(invitation, supplied) {
  const current = versionOf(invitation);
  // Existing, unversioned invitations remain editable during rollout. Once
  // versioned, old clients must reload instead of silently replacing new data.
  if (supplied === undefined && current === "legacy") return;
  if (supplied !== current) throw new EditConflict(current);
}
