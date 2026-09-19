import type { ReactNode } from 'react';

/** A titled card — the wrapper every dashboard panel and detail section shares. */
export function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="card">
      <header className="card-header">
        <h2>{title}</h2>
        {aside ? <div className="card-aside">{aside}</div> : null}
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
}
