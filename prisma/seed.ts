import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const trackings = [
  {
    trackingNumber: 'SB10001',
    customerName: 'Anna Kovalenko',
    status: 'delivered',
    eta: '2026-09-20',
    address: '12 Khreshchatyk St, Kyiv',
  },
  {
    trackingNumber: 'SB10002',
    customerName: 'John Smith',
    status: 'in_transit',
    eta: '2026-09-28',
    address: '123 Main St, Springfield',
  },
  {
    trackingNumber: 'SB10003',
    customerName: 'Maria Lopez',
    status: 'in_transit',
    eta: '2026-09-27',
    address: '45 Ocean Ave, Miami',
  },
  {
    trackingNumber: 'SB10004',
    customerName: 'Tom Wilson',
    status: 'delayed',
    eta: '2026-10-02',
    address: '9 Baker St, London',
  },
  {
    trackingNumber: 'SB10005',
    customerName: 'Elena Petrova',
    status: 'problem',
    eta: '—',
    address: '77 Nevsky Ave, Riga',
  },
  {
    trackingNumber: 'SB10006',
    customerName: 'David Brown',
    status: 'delivered',
    eta: '2026-09-18',
    address: '500 Pine St, Seattle',
  },
];

async function main() {
  for (const t of trackings) {
    // update: {} — create missing rows only; never overwrite state changed via the API
    await prisma.tracking.upsert({
      where: { trackingNumber: t.trackingNumber },
      update: {},
      create: t,
    });
  }
  console.log(`Seed done: ${trackings.length} tracking records ensured`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
