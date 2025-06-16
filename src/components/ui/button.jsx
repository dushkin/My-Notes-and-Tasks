import React from 'react';

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const base =
    'px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-500',
    outline: 'border border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500'
  };
  const btnClass = `${base} ${variants[variant] || variants.primary} ${className}`;
  return (
    <button className={btnClass} {...props}>
      {children}
    </button>
  );
}

export default Button;
