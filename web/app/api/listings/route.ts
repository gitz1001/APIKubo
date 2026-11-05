import { apiError, handleError, json, readJson, rejectCrossSite, requireUser } from "@/lib/server/http";
import { getRepo } from "@/lib/server/repo";
import { validateListingInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = rejectCrossSite(request, { requireJson: true });
  if (blocked) return blocked;
  const user = await requireUser();
  if (user instanceof Response) return user;

  const parsed = validateListingInput(await readJson(request));
  if (!parsed.ok) return apiError(422, "invalid", "Check the highlighted fields", parsed.errors);

  try {
    const listing = await getRepo().createListing(user.id, parsed.value);
    return json({ listing }, 201);
  } catch (error) {
    return handleError(error);
  }
}
