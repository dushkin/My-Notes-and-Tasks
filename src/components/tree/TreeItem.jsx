import React, { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768; // px threshold for mobile

const TreeItem = ({
  label,
  onRename = () => {},
  onSelect = () => {},
  onContextMenu = () => {},
  children,
  ...props
}) => {
  label,
  onRename,
  onSelect,
  onContextMenu,
  children,
  ...props
}) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLabelClick = () => {
    // On mobile, disable in-place rename via label click
    if (!isMobile) {
      onRename?.();
    }
    // otherwise ignore click
  };

  return (
    <div
      className="tree-item flex items-center"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      {...props}
    >
      <span
        className="tree-item-label flex-1"
        onClick={handleLabelClick}
        style={{ cursor: isMobile ? 'default' : 'pointer' }}
      >
        {label}
      </span>
      {children}
    </div>
  );
};

export default TreeItem;