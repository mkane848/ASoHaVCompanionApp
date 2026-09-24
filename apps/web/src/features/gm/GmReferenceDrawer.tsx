import { Fragment, useMemo } from 'react';
import type { GmReferenceSection, Library } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { parseGmReferenceBody, type GmReferenceListItem } from './gmReferenceBody.js';
import styles from './GmReferenceDrawer.module.css';

function scrollToSection(id: string) {
  document.getElementById(`gm-reference-section-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/** The GM reference (revised V0.6 slice 8): the ruleset's GM chapter — Running the Game, GM
 *  Principles, GM Moves, Soft & Hard Moves — seeded as `library.gmReference` and editable in
 *  Content Admin. GM-only by where it is mounted (the Campaign page's GM banner and Adventure
 *  Prep), and lazy-loaded from both so players never download it. Shares GlossaryDrawer's shell
 *  (`styles/drawer.module.css`) and `useModalA11y` wiring; every line goes through `GlossaryText`
 *  so rules terms link to the glossary. Rendered only while open. */
export function GmReferenceDrawer({ library, onClose }: { library: Library; onClose: () => void }) {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const matcher = useGlossaryMatcher();

  const sections = useMemo(() => [...library.gmReference].sort((a, b) => a.Order - b.Order), [library.gmReference]);

  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div
        ref={dialogRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-reference-drawer-title"
        tabIndex={-1}
      >
        <div className={styles.head}>
          <h2 id="gm-reference-drawer-title" className={styles.title}>GM Reference</h2>
          <button type="button" className={`tap ${styles.close}`} aria-label="Close the GM Reference" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className={styles.body}>
          {sections.length === 0 ? (
            <p className={styles.empty}>
              This library has no GM reference yet. A Content Admin can reset it to add one.
            </p>
          ) : (
            <>
              <div className={`tap-row ${styles.navRow}`}>
                {sections.map((section) => (
                  <button
                    key={section.Id}
                    type="button"
                    className={`tap-inline ${styles.navButton}`}
                    onClick={() => scrollToSection(section.Id)}
                  >
                    {section.Name}
                  </button>
                ))}
              </div>
              {sections.map((section) => (
                <GmReferenceSection key={section.Id} section={section} matcher={matcher} />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function GmReferenceSection({
  section,
  matcher,
}: {
  section: GmReferenceSection;
  matcher: ReturnType<typeof useGlossaryMatcher>;
}) {
  const blocks = useMemo(() => parseGmReferenceBody(section.Body), [section.Body]);

  return (
    <div id={`gm-reference-section-${section.Id}`} className={styles.section}>
      <h3 className={styles.sectionName}>{section.Name}</h3>
      {blocks.map((block, idx) =>
        block.type === 'paragraph' ? (
          <ParagraphBlock key={idx} lines={block.lines ?? []} matcher={matcher} />
        ) : (
          <ListBlock key={idx} items={block.items ?? []} matcher={matcher} />
        ),
      )}
    </div>
  );
}

function ParagraphBlock({
  lines,
  matcher,
}: {
  lines: string[];
  matcher: ReturnType<typeof useGlossaryMatcher>;
}) {
  return (
    <p className={styles.paragraph}>
      {lines.map((line, idx) => (
        <Fragment key={idx}>
          {idx > 0 && <br />}
          <GlossaryText text={line} matcher={matcher} />
        </Fragment>
      ))}
    </p>
  );
}

function ListBlock({
  items,
  matcher,
}: {
  items: GmReferenceListItem[];
  matcher: ReturnType<typeof useGlossaryMatcher>;
}) {
  return (
    <ul className={styles.list}>
      {items.map((item, idx) => (
        <ListItemNode key={idx} item={item} matcher={matcher} />
      ))}
    </ul>
  );
}

function ListItemNode({
  item,
  matcher,
}: {
  item: GmReferenceListItem;
  matcher: ReturnType<typeof useGlossaryMatcher>;
}) {
  return (
    <li>
      <GlossaryText text={item.text} matcher={matcher} />
      {item.children && item.children.length > 0 && (
        <ul className={styles.sublist}>
          {item.children.map((child, idx) => (
            <ListItemNode key={idx} item={child} matcher={matcher} />
          ))}
        </ul>
      )}
    </li>
  );
}
