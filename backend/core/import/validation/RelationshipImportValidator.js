export function validateRelationshipType({ relationshipType, installationResult } = {}) {
  if (!relationshipType) return { ok: true, relationshipType: null };

  const allowed = new Set(
    (installationResult?.relationshipTypes ?? []).map((entry) => String(entry.type)),
  );

  if (!allowed.size) {
    return {
      ok: false,
      errors: [{ code: "relationship_types_unavailable", message: "Package relationship types are not available." }],
    };
  }

  if (!allowed.has(String(relationshipType))) {
    return {
      ok: false,
      errors: [
        {
          code: "invalid_relationship_type",
          message: `Relationship type is not registered on the installed package: ${relationshipType}`,
          relationshipType,
        },
      ],
    };
  }

  return { ok: true, relationshipType: String(relationshipType) };
}
