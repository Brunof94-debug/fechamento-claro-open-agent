export const demo = {
  name: 'Ateliê Aurora — fictional October close',
  cutoff: '2026-10-21',
  currency: 'BRL',
  orders: `order_id,gross_cents,fee_cents,currency,due_date
A-1001,10000,300,BRL,2026-10-20
A-1002,20000,600,BRL,2026-10-20
A-1003,15000,450,BRL,2026-10-20
A-1004,8000,240,BRL,2026-10-20
A-1005,12000,360,BRL,2026-10-20
A-1006,9000,270,BRL,2026-10-20
A-1007,6000,180,BRL,2026-10-22`,
  settlements: `txn_id,order_id,net_cents,currency,posted_date
S-001,A-1001,9700,BRL,2026-10-20
S-002,A-1002,18400,BRL,2026-10-20
S-003,A-1003,7000,BRL,2026-10-20
S-004,A-1003,7550,BRL,2026-10-21
S-005,A-1004,5760,BRL,2026-10-21
S-006,A-1006,8730,BRL,2026-10-20
S-006,A-1006,8730,BRL,2026-10-20
S-007,A-1007,5820,BRL,2026-10-22
S-008,A-9999,1000,BRL,2026-10-20`,
  refunds: `refund_id,order_id,refund_cents,currency,posted_date
R-001,A-1004,2000,BRL,2026-10-21`
};
