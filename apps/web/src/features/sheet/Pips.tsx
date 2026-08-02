/** Pips carry a magnitude, not a clock: tapping pip n sets the value to n; tapping the
 *  currently-filled pip drops it to n-1. */
export function Pips({
  count,
  filled,
  color,
  size = 19,
  onSet,
}: {
  count: number;
  filled: number;
  color: string;
  size?: number;
  onSet: (n: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: size >= 18 ? 6 : 4 }}>
      {Array.from({ length: count }, (_, idx) => {
        const i = idx + 1;
        const on = i <= filled;
        return (
          <button
            key={i}
            type="button"
            title={`Set to ${i}`}
            onClick={() => onSet(filled === i ? i - 1 : i)}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              padding: 0,
              border: `1.5px solid ${on ? color : 'rgba(42,32,26,.28)'}`,
              background: on ? color : 'transparent',
            }}
          />
        );
      })}
    </div>
  );
}
