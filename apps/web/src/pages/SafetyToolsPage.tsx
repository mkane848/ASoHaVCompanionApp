import { Link, useParams } from 'react-router';
import { useBootstrap } from '../lib/useBootstrap.js';
import {
  LICENCE_LINKS,
  SAFETY_ACKNOWLEDGEMENTS,
  SAFETY_CHAPTERS,
  SAFETY_INTRO,
  SAFETY_LIVE_LINK,
  SAFETY_NOTES,
  SAFETY_SOURCES,
  SAFETY_TOOLKIT_CREDIT,
  SAFETY_TOOLKIT_LICENCE,
} from '../features/safety/safetyToolsContent.js';
import styles from './SafetyToolsPage.module.css';

/** The "Safety Tools" chapter of `Ruleset-V0.7.md`, as a page every campaign member can open (V0.7
 *  slice 11). Static reference content: no server route, no stored state, so nothing here is gated
 *  on role or campaign phase. It sits under the campaign only so the back link has somewhere to
 *  go; the content is the same in every campaign. The text, the licence note and the required
 *  credit line live in `features/safety/safetyToolsContent.ts`. */
export default function SafetyToolsPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading } = useBootstrap(campaignId);

  if (isLoading || !boot || !campaignId) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.page}>
      <Link to={`/c/${campaignId}`} className={styles.back}>
        &larr; {boot.campaign.Name}
      </Link>
      <h1 className={styles.title}>Safety Tools</h1>
      <p className={styles.intro}>{SAFETY_INTRO}</p>

      {SAFETY_CHAPTERS.map((chapter) => (
        <section key={chapter.heading} className={styles.chapter}>
          <h2 className={styles.chapterTitle}>{chapter.heading}</h2>
          {chapter.topics.map((topic) => (
            <div key={topic.heading} className={styles.topic}>
              <h3 className={styles.topicTitle}>{topic.heading}</h3>
              {topic.paragraphs.map((p) => (
                <p key={p} className={styles.body}>{p}</p>
              ))}
            </div>
          ))}
        </section>
      ))}

      <section className={styles.chapter}>
        <h2 className={styles.chapterTitle}>Sources and Acknowledgements</h2>
        <div className={styles.topic}>
          <h3 className={styles.topicTitle}>Sources</h3>
          <ul className={styles.sources}>
            {SAFETY_SOURCES.map((s) => (
              <li key={s.text} className={styles.source}>
                <span className={styles.body}>{s.text}</span>
                {s.href && (
                  <a href={s.href} target="_blank" rel="noreferrer" className={`tap-inline ${styles.link}`}>
                    Original ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.topic}>
          <h3 className={styles.topicTitle}>Acknowledgements</h3>
          {SAFETY_ACKNOWLEDGEMENTS.map((p) => (
            <p key={p} className={styles.body}>{p}</p>
          ))}
        </div>
      </section>

      <section className={styles.chapter}>
        <h2 className={styles.chapterTitle}>Additional Notes</h2>
        {SAFETY_NOTES.map((topic) => (
          <div key={topic.heading} className={styles.topic}>
            <h3 className={styles.topicTitle}>{topic.heading}</h3>
            {topic.paragraphs.map((p) => (
              <p key={p} className={styles.body}>{p}</p>
            ))}
          </div>
        ))}
        <div className={`tap-row ${styles.links}`}>
          <a href={SAFETY_LIVE_LINK} target="_blank" rel="noreferrer" className={`tap-inline ${styles.link}`}>
            bit.ly/ttrpgsafetytoolkit ↗
          </a>
        </div>
      </section>

      <section className={styles.chapter} aria-labelledby="safety-licence-title">
        <h2 id="safety-licence-title" className={styles.chapterTitle}>Using the TTRPG Safety Toolkit</h2>
        {SAFETY_TOOLKIT_LICENCE.map((p) => (
          <p key={p} className={styles.body}>{p}</p>
        ))}
        <blockquote className={styles.credit}>{SAFETY_TOOLKIT_CREDIT}</blockquote>
        <div className={`tap-row ${styles.links}`}>
          {LICENCE_LINKS.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className={`tap-inline ${styles.link}`}>
              {l.label} ↗
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
