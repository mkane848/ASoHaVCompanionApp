export type PickerState =
  | { kind: 'advancement'; track: 'Rapport' }
  | { kind: 'bond'; bondId: string; partnerName: string }
  | null;
