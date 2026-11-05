import { apiError, handleError, json, readJson, rejectCrossSite, requireUser, UUID_RE } from "@/lib/server/http";
import { getRepo } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** Subscribe to a free plan. Paid plans will go through checkout + a billing webhook. */
export async function POST(request: Request) {
  const blocked = rejectCrossSite(request, { requireJson: true });
  if (blocked) return blocked;
  const user = await requireUser();
  if (user instanceof Response) return user;

  const body = await readJson(request);
  const planId = typeof body === "object" && body !== null ? (body as { planId?: unknown }).planId : undefined;
  if (typeof planId !== "string" || !UUID_RE.test(planId)) return apiError(422, "invalid", "planId is required");

  try {
    await getRepo().subscribeFree(user.id, planId);
    return json({ ok: true }, 201);
  } catch (error) {
    return handleError(error);
  }
}
