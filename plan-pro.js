// PingClass - Pro Plan
const PLAN_PRO = {
  id: 'pro',
  name: 'Pro',
  price: 599,
  currency: 'INR',
  interval: 'month',

  limits: {
    maxStudents: Infinity,
    maxBatches: Infinity,
    maxTeachers: Infinity
  },

  features: {
    attendance: true,
    feeReminders: true,
    parentApp: true,
    announcements: true,
    multipleTeachers: true,
    prioritySupport: true,
    exportReports: true,
    customBranding: true
  },

  access: {
    students: true,
    batches: true,
    fees: true,
    attendance: true,
    announcements: true,
    settings: true,
    reports: true
  }
};

if (typeof window !== 'undefined') window.PLAN_PRO = PLAN_PRO;
