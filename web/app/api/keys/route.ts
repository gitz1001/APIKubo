import { isSupabaseConfigured } from "@/lib/env";
import { generateApiKey } from "@/lib/server/api-keys";
import { apiError, handleError, json, readJson, rejectCrossSite, requireUser } from "@/lib/server/http";
import { getRepo } from "@/lib/server/repo";
import { validateKeyName } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Create an API key. The plaintext secret is returned once and never stored. */
export async function POST(request: Request) {
  const blocked = rejectCrossSite(request, { requireJson: true });
  if (blocked) return blocked;
  const user = await requireUser();
  if (user instanceof Response) return user;

  const parsed = validateKeyName(await readJson(request));
  if (!parsed.ok) return apiError(422, "invalid", "Check the highlighted fields", parsed.errors);

  try {
    const generated = generateApiKey(isSupabaseConfigured() ? "live" : "test");
    const key = await getRepo().createKey(user.id, parsed.value, generated.prefix, generated.hash);
    return json({ key, secret: generated.secret }, 201);
  } catch (error) {
    return handleError(error);
  }
}
