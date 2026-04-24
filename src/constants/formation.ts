export const FORMATION_433 = ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LCM', 'CM', 'RCM', 'LW', 'ST', 'RW'] as const;

export const POSITION_LAYOUT: Record<string, { top: string; left: string }> = {
  GK: { top: '93%', left: '50%' },
  LB: { top: '68%', left: '10%' },
  LCB: { top: '78%', left: '31%' },
  RCB: { top: '78%', left: '69%' },
  RB: { top: '68%', left: '90%' },
  LCM: { top: '52%', left: '24%' },
  CM: { top: '40%', left: '50%' },
  RCM: { top: '52%', left: '76%' },
  LW: { top: '24%', left: '16%' },
  ST: { top: '10%', left: '50%' },
  RW: { top: '24%', left: '84%' },
};
