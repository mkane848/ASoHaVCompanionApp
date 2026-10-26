import { Fragment, useMemo } from 'react';
import type { GmReferenceSection, Library } from '@asohav/shared';
import { parseGmReferenceBody, type GmReferenceListItem } from '../gm/gmReferenceBody.js';
import styles from './PrintGmReference.module.css';

/**
 * The GM Reference laid out for paper: `library.gmReference`, read exactly the way
 * `GmReferenceDrawer` reads it (sorted by `Order`, each `Body` through `parseGmReferenceBody`), so
 * an edit in Content Admin reaches the printout and no rules text lives here. Plain text on
 * purpose: the drawer's glossary links mean nothing on paper.
 *
 * `hidden` holds the ids of sections the preview's toolbar has switched off.
 * The drift guard is `printGmReferenceCoverage.ts`.
 */
export function PrintGmReference({
  library,
  campaignName,
  hidden,
  printedOn,
}: {
  library: Library;
  campaignName?: string;
  hidden?: ReadonlySet<string>;
  printedOn?: string;
}) {
  const sections = useMemo(() => [...library.gmReference].sort((a, b) => a.Order - b.Order), [library.gmReference]);
  const shown = sections.filter((s) => !hidden?.has(s.Id));

  return (
    <div className={styles.sheet}>
      <header className={styles.masthead}>
        <h1 className={styles.title}>GM Reference</h1>
        {campaignName && <div className={styles.campaign}>{campaignName}</div>}
      </header>

      {sections.length === 0 ? (
        <p>This library has no GM reference yet. A Content Admin can reset it to add one.</p>
      ) : (
        <div className={styles.flow}>
          {shown.map((section) => (
            <Section key={section.Id} section={section} />
          ))}
        </div>
      )}

      <footer className={styles.footer}>
        Printed from the ASoHaV Companion App · library seed {library.SeedVersion}
        {printedOn ? ` · ${printedOn}` : ''}
      </footer>
    </div>
  );
}

function Section({ section }: { section: GmReferenceSection }) {
  const blocks = useMemo(() => parseGmReferenceBody(section.Body), [section.Body]);
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionName}>{section.Name}</h2>
      {blocks.map((block, idx) =>
        block.type === 'paragraph' ? (
          <p key={idx} className={styles.paragraph}>
            {(block.lines ?? []).map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </p>
        ) : (
          <ul key={idx} className={styles.list}>
            {(block.items ?? []).map((item, i) => (
              <Item key={i} item={item} top />
            ))}
          </ul>
        ),
      )}
    </section>
  );
}

/** A top-level bullet (one Principle, one Move) is kept whole; nested bullets stay with their parent. */
function Item({ item, top }: { item: GmReferenceListItem; top?: boolean }) {
  return (
    <li className={top ? styles.item : undefined}>
      {item.text}
      {item.children && item.children.length > 0 && (
        <ul className={styles.sublist}>
          {item.children.map((child, i) => (
            <Item key={i} item={child} />
          ))}
        </ul>
      )}
    </li>
  );
}
