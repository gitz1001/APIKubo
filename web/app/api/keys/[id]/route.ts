import { apiError, handleError, json, rejectCrossSite, requireUser, UUID_RE } from "@/lib/server/http";
import { getRepo } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** Revoke (not delete) so usage history stays attributable. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const blocked = rejectCrossSite(request, { requireJson: false });
  if (blocked) return blocked;
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (!UUID_RE.test(params.id)) return apiError(404, "not_found", "Key not found");

  try {
    await getRepo().revokeKey(user.id, params.id);
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
