export const FORMATION_433 = ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LCM', 'CM', 'RCM', 'LW', 'ST', 'RW'] as const;

export const POSITION_LAYOUT: Record<string, { top: string; left: string }> = {
  GK: { top: '88%', left: '50%' },
  LB: { top: '72%', left: '18%' },
  LCB: { top: '74%', left: '38%' },
  RCB: { top: '74%', left: '62%' },
  RB: { top: '72%', left: '82%' },
  LCM: { top: '56%', left: '30%' },
  CM: { top: '46%', left: '50%' },
  RCM: { top: '56%', left: '70%' },
  LW: { top: '32%', left: '20%' },
  ST: { top: '24%', left: '50%' },
  RW: { top: '32%', left: '80%' },
};
