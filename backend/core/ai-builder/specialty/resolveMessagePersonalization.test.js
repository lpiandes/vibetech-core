import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPersonalizationValues,
  previewMessagePersonalization,
  resolveMessagePersonalization,
} from "./resolveMessagePersonalization.js";

test("resolves owner-friendly tokens from Meta lead payload", () => {
  const body = [
    "A new Facebook lead has been received.",
    "Lead details",
    "Name: [Name]",
    "Phone: [Phone]",
    "Email: [Email]",
  ].join("\n");
  const resolved = resolveMessagePersonalization(body, {
    name: "John Doe",
    phone: "555-0100",
    email: "j@x.com",
  });
  assert.match(resolved, /Name: John Doe/);
  assert.match(resolved, /Phone: 555-0100/);
  assert.match(resolved, /Email: j@x.com/);
  assert.doesNotMatch(resolved, /\[Name\]/);
});

test("Lead details chip expands with custom form fields", () => {
  const resolved = resolveMessagePersonalization("[Lead details]", {
    name: "Jane",
    phone: "555",
    email: "j@e.com",
    fields: { care_for: "Myself", care_needed_immediately: "Yes" },
  });
  assert.match(resolved, /Care For: Myself/);
  assert.match(resolved, /Care Needed Immediately: Yes/);
});

test("preview uses sample lead so owners see the filled message", () => {
  const preview = previewMessagePersonalization("Hi [Name] — we got [Email]");
  assert.match(preview, /Hi John Doe/);
  assert.match(preview, /john@example.com/);
});

test("buildPersonalizationValues prefers nested contact", () => {
  const values = buildPersonalizationValues({
    eventPayload: {
      contact: { name: "Nested", email: "n@e.com", phone: "1" },
    },
  });
  assert.equal(values.name, "Nested");
});
