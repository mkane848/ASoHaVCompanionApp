export type PickerState =
  | { kind: 'advancement'; track: 'Potential' | 'Rapport' }
  | { kind: 'bond'; bondId: string; partnerName: string }
  | null;
