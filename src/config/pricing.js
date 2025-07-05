export const PRICING_PLANS = {
  // Production plans
  monthly: {
    id: 'monthly',
    label: 'Monthly',
    price: 8,
    paddleProductId: 'pri_01jye8wkv4jd6efagj53fq6tja', // production
    // paddleProductId: 'pri_01jz1043r8e6pq4hkze626xhxz', // sandbox
    description: 'per month'
  },
  yearly: {
    id: 'yearly',
    label: 'Yearly',
    price: 80,
    paddleProductId: 'pri_01jye8zf69nezhaakp0ymharrf', // production
    // paddleProductId: 'pri_01jz105py7ptzh8pj9av8ve48b', // sandbox
    description: 'per year (Save 16.6%)'
  },
  lifetime: {
    id: 'lifetime',
    label: 'Lifetime',
    price: 200,
    paddleProductId: 'pri_01jye945p2k95at00t2f3z1vj7', // production
    // paddleProductId: 'pri_01jz107g4635cfdag5vs6zvhy7', // sandbox
    description: 'one-time payment'
  },
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