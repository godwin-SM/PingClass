// PingClass Config — PRODUCTION
// When served by app.py, this file is generated at runtime from environment
// variables (see .env / `supabase secrets set`). This static copy is only a
// fallback for static hosting and must be kept in sync with app.py.
const CONFIG = {
  RAZORPAY_KEY_ID: 'rzp_test_TA9d1aYSVLeGFh',
  SUPABASE_URL: 'https://evrqzgjksmidqhzvckhq.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2cnF6Z2prc21pZHFoenZja2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTE4MzksImV4cCI6MjEwMDEyNzgzOX0.UV4YLbfJwszr-zzzkpJgbLbQ4ZZhiGVYzlAHpst45mE',

  // Plan pricing (in INR paise for Razorpay)
  PLANS: {
    free: { name: 'Free', amount: 0, razorpayPlanId: null },
    basic: { name: 'Basic', amount: 24900, razorpayPlanId: null }, // ₹249
    pro: { name: 'Pro', amount: 59900, razorpayPlanId: null }       // ₹599
  }
};
