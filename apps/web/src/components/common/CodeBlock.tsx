/** Displays code exactly as given — rendered as React text, so it can never be interpreted as markup. */
export function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <pre className="code-block" aria-label={label} tabIndex={0}>
      <code>{code}</code>
    </pre>
  );
}
