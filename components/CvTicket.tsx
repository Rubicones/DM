import type { ContactStation } from '@/config/content';

export function CvTicket({ cv }: { cv: NonNullable<ContactStation['cv']> }) {
  const contents = (
    <>
      <span className="cv-paper" aria-hidden>
        <span className="cv-paper-name t-label">{cv.name}</span>
        <span className="cv-paper-title t-display">CV<span>↗</span></span>
        <span className="cv-paper-lines"><i /><i /><i /></span>
      </span>
      <span className="cv-ticket-copy">
        <span className="t-label cv-eyebrow">A little takeaway</span>
        <span className="t-display cv-ticket-title">Take the short version.</span>
        <span className="t-body-sm">My story, in a document you can keep.</span>
        <span className="cv-ticket-action t-label">
          {cv.href ? 'Download CV · PDF' : 'PDF coming soon'}
          {cv.href && <span aria-hidden> ↓</span>}
        </span>
      </span>
      <span className="cv-ticket-stub t-label" aria-hidden><span>KEEP IN TOUCH</span><span>↓</span></span>
    </>
  );

  return cv.href ? (
    <a className="cv-ticket" href={cv.href} download aria-label={`Download ${cv.name}'s CV (PDF)`}>
      {contents}
    </a>
  ) : (
    <div className="cv-ticket" role="group" aria-label={`${cv.name}'s CV — PDF coming soon`} data-pending>
      {contents}
    </div>
  );
}
