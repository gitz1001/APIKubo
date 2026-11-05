import { apiError, handleError, json, readJson, rejectCrossSite, requireUser, UUID_RE } from "@/lib/server/http";
import { getRepo } from "@/lib/server/repo";
import type { ListingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: ListingStatus[] = ["draft", "published", "archived"];

/** Publish, unpublish (draft) or archive a listing the caller owns. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const blocked = rejectCrossSite(request, { requireJson: true });
  if (blocked) return blocked;
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (!UUID_RE.test(params.id)) return apiError(404, "not_found", "Listing not found");

  const body = await readJson(request);
  const status = typeof body === "object" && body !== null ? (body as { status?: unknown }).status : undefined;
  if (typeof status !== "string" || !STATUSES.includes(status as ListingStatus)) {
    return apiError(422, "invalid", "status must be draft, published or archived");
  }

  try {
    await getRepo().setListingStatus(user.id, params.id, status as ListingStatus);
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
