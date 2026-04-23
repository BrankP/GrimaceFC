export const FORMATION_433 = ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LCM', 'CM', 'RCM', 'LW', 'ST', 'RW'] as const;

export const POSITION_LAYOUT: Record<string, { top: string; left: string }> = {
  GK: { top: '90%', left: '50%' },
  LB: { top: '60%', left: '14%' },
  LCB: { top: '70%', left: '34%' },
  RCB: { top: '70%', left: '66%' },
  RB: { top: '60%', left: '86%' },
  LCM: { top: '50%', left: '28%' },
  CM: { top: '35%', left: '50%' },
  RCM: { top: '50%', left: '72%' },
  LW: { top: '20%', left: '20%' },
  ST: { top: '8%', left: '50%' },
  RW: { top: '20%', left: '80%' },
};
