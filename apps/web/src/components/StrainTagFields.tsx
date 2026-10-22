import type { StrainTag } from '@asohav/shared';
import { Field } from './form/Field.js';
import { Select } from './form/Select.js';
import { TextInput } from './form/TextInput.js';

type TagKind = 'untagged' | 'body' | 'other';

const kindOf = (tag: StrainTag | undefined): TagKind => (!tag ? 'untagged' : tag.OnBody ? 'body' : 'other');

/** Drops a tag that says nothing back to `undefined`, so an untouched form doesn't send an empty tag. */
export function cleanStrainTag(tag: StrainTag | undefined): StrainTag | undefined {
  if (!tag) return undefined;
  return { OnBody: tag.OnBody, Effect: tag.Effect.trim() };
}

/** The GM's tag on an incoming Strain hit (V0.7 slice 7, `docs/decisions.md` item 70). The Armor
 *  rules read it: Armor stops any one source, Heavy Armor needs the hit on the body, Special Armor
 *  needs a listed effect. Optional — "Not tagged" leaves Heavy and Special for the table to call.
 *  Used by the GM's attack modal and by the sheet's Take Strain modal (a player relaying what the
 *  GM said). */
export function StrainTagFields({
  value,
  onChange,
  idPrefix,
}: {
  value: StrainTag | undefined;
  onChange: (next: StrainTag | undefined) => void;
  idPrefix: string;
}) {
  const kind = kindOf(value);
  return (
    <>
      <Field label="How does it hit? (for Armor)" htmlFor={`${idPrefix}-kind`}>
        <Select
          id={`${idPrefix}-kind`}
          value={kind}
          onChange={(e) => {
            const next = e.target.value as TagKind;
            if (next === 'untagged') onChange(undefined);
            else onChange({ OnBody: next === 'body', Effect: value?.Effect ?? '' });
          }}
        >
          <option value="untagged">Not tagged — the table decides</option>
          <option value="body">On the body (a blow, a shield or mail can stop it)</option>
          <option value="other">Not on the body</option>
        </Select>
      </Field>
      {value && (
        <Field label="Effect, for Special Armor (optional)" htmlFor={`${idPrefix}-effect`}>
          <TextInput
            id={`${idPrefix}-effect`}
            value={value.Effect}
            onChange={(e) => onChange({ ...value, Effect: e.target.value })}
            placeholder="fire, poison, magic…"
          />
        </Field>
      )}
    </>
  );
}
