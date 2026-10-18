import { InfoTooltip, TooltipSection } from '../../components/InfoTooltip.js';
import styles from './HeroRollBuilder.module.css';

/** Aid is invoked after the dice land, from the Party's Skill Tags, so the builder only explains it. */
export function AidSection() {
  return (
    <div className={styles.advantageRow}>
      <span>Aid</span>
      <InfoTooltip label="Aid">
        <TooltipSection label="What it means">
          Any teammate can Aid you by invoking a Party Skill Tag to give you +1 on this roll — and they
          can do it <em>after</em> the dice land. They describe how they realistically help first.
          Several teammates can contribute to the same roll, but each of them can only invoke one
          Party Skill Tag per action, and the total Aid on a roll can not exceed +3. A tag used this
          way stays used until the Party Makes Camp, and you mark Rapport whether the roll succeeds
          or misses.
        </TooltipSection>
        <TooltipSection label="How it works here">
          Teammates Aid from the Advancement panel, or from your Combat card: the app marks the tag
          used, marks the Rapport, and records who helped. This app can&apos;t see &ldquo;a
          roll,&rdquo; so it doesn&apos;t enforce the one-tag-per-teammate limit or add the bonus to
          the total above — that stays with the table, same as Advantage.
        </TooltipSection>
      </InfoTooltip>
    </div>
  );
}
