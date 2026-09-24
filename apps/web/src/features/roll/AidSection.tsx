import { InfoTooltip, TooltipSection } from '../../components/InfoTooltip.js';
import styles from './HeroRollBuilder.module.css';

/** Aid is spent after the dice land, from the Rapport track, so the builder only explains it. */
export function AidSection() {
  return (
    <div className={styles.advantageRow}>
      <span>Aid</span>
      <InfoTooltip label="Aid">
        <TooltipSection label="What it means">
          Any teammate can spend 1 Rapport to give you +1 on this roll — and they can do it
          <em> after</em> the dice land. Several teammates can stack Aid on the same roll, but each
          of them can only spend once on it. Adding +1 this way can not exceed +3 total on the roll.
        </TooltipSection>
        <TooltipSection label="How it works here">
          Spending happens on the Rapport track (Advancement panel, or a teammate's Combat card).
          This app can't see &ldquo;a roll,&rdquo; so it doesn't enforce the once-per-teammate
          limit or add the bonus to the total above — that stays with the table, same as
          Advantage. What it does track is the Rapport itself, and who spent it.
        </TooltipSection>
      </InfoTooltip>
    </div>
  );
}
