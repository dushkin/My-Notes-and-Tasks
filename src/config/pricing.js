// src/config/pricing.js

export const PRICING_PLANS = {
  // Your existing production plans
  monthly: {
    id: 'monthly',
    label: 'Monthly',
    price: 8,
    paddleProductId: 'pri_01jye8wkv4jd6efagj53fq6tja', // Your actual monthly price ID
    description: 'per month'
  },
  yearly: {
    id: 'yearly',
    label: 'Yearly',
    price: 80,
    paddleProductId: 'pri_01jye8zf69nezhaakp0ymharrf', // Your actual yearly price ID
    description: 'per year (Save 16.6%)'
  },
  lifetime: {
    id: 'lifetime',
    label: 'Lifetime',
    price: 200,
    paddleProductId: 'pri_01jye945p2k95at00t2f3z1vj7', // Your actual lifetime price ID
    description: 'one-time payment'
  },
  
  // Add test products (only show in development)
  testRecurring: {
    id: 'testRecurring',
    label: 'Test Recurring',
    price: 1.00,
    paddleProductId: 'pri_01jygpyt96eqt06789zkgtm5qw',
    description: 'per month (TEST ONLY)',
    isTest: true
  },
  testOnetime: {
    id: 'testOnetime',
    label: 'Test One-time',
    price: 1.00,
    paddleProductId: 'pri_01jygq1f8vt0a7nwab12yv1m62',
    description: 'one-time payment (TEST ONLY)',
    isTest: true
  }
};

// Helper function to get available plans based on environment
export const getAvailablePlans = () => {
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1');
  
  if (isLocalhost) {
    // Show both test and real plans in development
    return PRICING_PLANS;
  } else {
    // Only show real plans in production
    const prodPlans = {};
    Object.entries(PRICING_PLANS).forEach(([key, plan]) => {
      if (!plan.isTest) {
        prodPlans[key] = plan;
      }
    });
    return prodPlans;
  }
};