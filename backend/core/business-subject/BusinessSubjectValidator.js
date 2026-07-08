export function validateBusinessSubjectRuntime(runtime) {
  if (!runtime?._state) throw new Error("BusinessSubjectValidator: runtime state required.");
  const subjects = runtime._state.subjects;
  if (!Array.isArray(subjects)) throw new Error("BusinessSubjectValidator: subjects must be array.");
  return { ok: true };
}
