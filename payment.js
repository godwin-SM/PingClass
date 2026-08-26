// PingClass Payment Integration (Razorpay)

const Payment = {
  // Load Razorpay script
  loadScript() {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve();
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  },

  // Open Razorpay checkout
  async openCheckout(planId, db, user) {
    const plan = CONFIG.PLANS[planId];
    if (!plan || plan.amount === 0) return null;

    await this.loadScript();

    const { data: { session } } = await db.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('No session');

    // Create a server-side order so the amount is locked and Razorpay
    // accepts the checkout (the legacy key+amount flow gets 500 and is
    // auto-refunded anyway).
    const orderRes = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ plan_id: planId })
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok || !orderData.order_id) {
      throw new Error(orderData?.error || 'Could not start checkout');
    }

    return new Promise((resolve, reject) => {
      const options = {
        key: CONFIG.RAZORPAY_KEY_ID,
        order_id: orderData.order_id,
        name: 'PingClass',
        description: `${plan.name} Plan - Monthly`,
        handler: async function (response) {
          // Payment successful
          const paymentData = {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            plan_id: planId,
            amount: plan.amount / 100,
            user_id: user.id,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          };

          try {
            // Store subscription server-side after Razorpay verification
            const { data: { session } } = await db.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No session');

            const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': CONFIG.SUPABASE_ANON_KEY
              },
              body: JSON.stringify({
                plan_id: planId,
                payment_id: response.razorpay_payment_id,
                order_id: response.razorpay_order_id,
                signature: response.razorpay_signature
              })
            });

            const result = await res.json();
            if (!res.ok) console.warn('Subscription store failed (payment still valid):', result?.error);
            if (window.fluidResume) window.fluidResume();
            resolve(paymentData);
          } catch (err) {
            console.warn('Subscription store failed (payment still valid):', err);
            if (window.fluidResume) window.fluidResume();
            resolve(paymentData);
          }
        },
        prefill: {
          email: user.email || '',
          contact: user.phone || ''
        },
        theme: {
          color: '#0D9488'
        },
        modal: {
          ondismiss: function () {
            if (window.fluidResume) window.fluidResume();
            reject(new Error('Payment cancelled'));
          }
        }
      };

      if (window.fluidPause) window.fluidPause();
      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  },

  // Check if user has active subscription
  async getActivePlan(db, userId) {
    try {
      const { data, error } = await db.rpc('get_active_plan', { p_user_id: userId });
      if (error || !data) return 'free';
      return data; // 'free', 'basic', or 'pro'
    } catch (err) {
      console.error('Failed to check subscription:', err);
      return 'free';
    }
  },

  // Get plan config by ID
  getPlanConfig(planId) {
    const plans = { free: PLAN_FREE, basic: PLAN_BASIC, pro: PLAN_PRO };
    return plans[planId] || PLAN_FREE;
  },

  // Check if user has access to a feature
  hasFeature(planId, feature) {
    const plan = this.getPlanConfig(planId);
    return plan.features[feature] === true;
  },

  // Check if user has access to a dashboard section
  hasAccess(planId, section) {
    const plan = this.getPlanConfig(planId);
    return plan.access[section] === true;
  },

  // Check if user is within limits
  checkLimit(planId, type, currentCount) {
    const plan = this.getPlanConfig(planId);
    const limit = plan.limits[`max${type.charAt(0).toUpperCase() + type.slice(1)}`];
    if (limit === Infinity) return true;
    return currentCount < limit;
  }
};

if (typeof window !== 'undefined') window.Payment = Payment;
