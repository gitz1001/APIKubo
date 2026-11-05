// Run with: npm test  (node --test, no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPublicHttpsUrl, safeNextPath, slugify, validateHandle, validateKeyName, validateListingInput } from "./validation.ts";

test("safeNextPath blocks open redirects", () => {
  assert.equal(safeNextPath("/submit"), "/submit");
  assert.equal(safeNextPath("/listings/a?x=1"), "/listings/a?x=1");
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined, "/\tx"]) {
    assert.equal(safeNextPath(bad), "/dashboard", String(bad));
  }
});

test("slugify produces gateway-safe slugs", () => {
  assert.equal(slugify("  Global FX Matrix! "), "global-fx-matrix");
  assert.equal(slugify("Café Señor"), "cafe-senor");
  assert.equal(slugify("x".repeat(80)).length, 50);
});

test("checkPublicHttpsUrl rejects private and insecure targets", () => {
  assert.equal(checkPublicHttpsUrl("https://api.example.com/v1"), null);
  for (const bad of ["http://api.example.com", "https://localhost:3000", "https://10.1.2.3", "https://169.254.169.254",
    "https://user:pw@api.example.com", "https://api.example.com/v1?key=1", "not a url", "https://172.20.0.1"]) {
    assert.notEqual(checkPublicHttpsUrl(bad), null, bad);
  }
});

const validListing = {
  name: "Weather Pro",
  slug: "weather-pro",
  tagline: "Forecasts",
  description: "",
  type: "api",
  category: "geo",
  base_url: "https://api.weather.example/v2/",
  documentation_url: "",
  status: "published",
  free_plan: { rate_limit_rpm: "60", quota_monthly: 1000 },
};

test("validateListingInput normalises a valid payload", () => {
  const result = validateListingInput(validListing);
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.value.base_url, "https://api.weather.example/v2");
    assert.equal(result.value.description, null);
    assert.deepEqual(result.value.free_plan, { rate_limit_rpm: 60, quota_monthly: 1000 });
  }
});

test("validateListingInput reports every bad field", () => {
  const result = validateListingInput({ ...validListing, slug: "-Bad", type: "x", base_url: "http://x", free_plan: { rate_limit_rpm: 0 } });
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.deepEqual(Object.keys(result.errors).sort(), ["base_url", "quota_monthly", "rate_limit_rpm", "slug", "type"]);
  }
  assert.ok(!validateListingInput(null).ok);
  assert.ok(!validateListingInput([]).ok);
});

test("handles and key names", () => {
  assert.ok(validateHandle("ada_l").ok);
  assert.ok(!validateHandle("ab").ok);
  assert.ok(!validateHandle("user_123").ok);
  assert.ok(!validateHandle("Has Space").ok);
  assert.ok(validateKeyName({ name: " CI key " }).ok);
  assert.ok(!validateKeyName({ name: "" }).ok);
  assert.ok(!validateKeyName("raw").ok);
});
