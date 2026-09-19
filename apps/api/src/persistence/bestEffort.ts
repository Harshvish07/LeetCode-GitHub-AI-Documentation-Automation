/**
 * Runs a dashboard-recording action without letting its failure break the
 * request that triggered it. The review/document/publish endpoints exist to
 * produce a review, a document, and a commit; the learning read-model that
 * feeds the dashboard is *derived* from those results, so a database outage
 * must not throw away an AI review that already cost money, or hide a
 * GitHub commit that already happened. The failure is logged (message only —
 * never the SQL parameters, which contain submitted code) rather than
 * swallowed silently. See docs/database.md#recording-is-best-effort.
 */
export async function recordBestEffort(
  label: string,
  action: () => Promise<void> | undefined,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.error(
      `[persistence] failed to record ${label}:`,
      error instanceof Error ? error.message : 'unknown error',
    );
  }
}
