// PingClass - Basic Plan
const PLAN_BASIC = {
  id: 'basic',
  name: 'Basic',
  price: 249,
  currency: 'INR',
  interval: 'month',

  limits: {
    maxStudents: 100,
    maxBatches: 5,
    maxTeachers: 5
  },

  features: {
    attendance: true,
    feeReminders: true,
    parentApp: true,
    announcements: true,
    multipleTeachers: true,
    prioritySupport: false,
    exportReports: true,
    customBranding: false
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

if (typeof window !== 'undefined') window.PLAN_BASIC = PLAN_BASIC;
