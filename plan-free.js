// PingClass - Free Plan
const PLAN_FREE = {
  id: 'free',
  name: 'Free',
  price: 0,
  currency: 'INR',
  interval: 'month',

  limits: {
    maxStudents: 20,
    maxBatches: 1,
    maxTeachers: 1
  },

  features: {
    attendance: true,
    feeReminders: true,
    parentApp: false,
    announcements: false,
    multipleTeachers: false,
    prioritySupport: false,
    exportReports: false,
    customBranding: false
  },

  // Dashboard feature access
  access: {
    students: true,
    batches: true,
    fees: true,
    attendance: true,
    announcements: false,
    settings: true,
    reports: false
  }
};

if (typeof window !== 'undefined') window.PLAN_FREE = PLAN_FREE;
