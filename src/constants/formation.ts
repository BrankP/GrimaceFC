export const FORMATION_433 = ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LCM', 'CM', 'RCM', 'LW', 'ST', 'RW'] as const;

export const POSITION_LAYOUT: Record<string, { top: string; left: string }> = {
  GK: { top: '90%', left: '50%' },
  LB: { top: '74%', left: '14%' },
  LCB: { top: '78%', left: '34%' },
  RCB: { top: '78%', left: '66%' },
  RB: { top: '74%', left: '86%' },
  LCM: { top: '56%', left: '28%' },
  CM: { top: '46%', left: '50%' },
  RCM: { top: '56%', left: '72%' },
  LW: { top: '28%', left: '20%' },
  ST: { top: '10%', left: '50%' },
  RW: { top: '28%', left: '80%' },
};
