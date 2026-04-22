export const FORMATION_433 = ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LCM', 'CM', 'RCM', 'LW', 'ST', 'RW'] as const;

export const POSITION_LAYOUT: Record<string, { top: string; left: string }> = {
  GK: { top: '88%', left: '50%' },
  LB: { top: '70%', left: '14%' },
  LCB: { top: '74%', left: '34%' },
  RCB: { top: '74%', left: '66%' },
  RB: { top: '70%', left: '86%' },
  LCM: { top: '54%', left: '28%' },
  CM: { top: '44%', left: '50%' },
  RCM: { top: '54%', left: '72%' },
  LW: { top: '30%', left: '20%' },
  ST: { top: '20%', left: '50%' },
  RW: { top: '30%', left: '80%' },
};
