import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const FloatingActionButton = ({ 
  onCreateItem, 
  disabled = false, 
  selectedItem = null, 
  position = 'fixed' // 'fixed' for mobile overlay, 'relative' for desktop in-tree, 'inline' for inline positioning
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const fabRef = useRef(null);
  
  useFocusTrap(fabRef, isExpanded);

  // Generate context-aware item types based on current selection
  const getAvailableItemTypes = () => {
    const baseTypes = [];
    
    baseTypes.push({
      type: 'root-folder',
      label: 'Root Folder',
      icon: '📁',
      description: 'Create a new folder at root level'
    });

    // Only show additional options if a folder is selected
    if (selectedItem && selectedItem.type === 'folder') {
      baseTypes.push({
        type: 'subfolder',
        label: 'Subfolder',
        icon: '📂',
        description: `Create a subfolder in "${selectedItem.label}"`
      });

      baseTypes.push({
        type: 'note',
        label: 'Note',
        icon: '📝',
        description: `Create a note in "${selectedItem.label}"`
      });
      
      baseTypes.push({
        type: 'task',
        label: 'Task',
        icon: '✅',
        description: `Create a task in "${selectedItem.label}"`
      });
    }

    return baseTypes;
  };

  const itemTypes = getAvailableItemTypes();

  // Handle outside click to close expanded menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fabRef.current && !fabRef.current.contains(event.target)) {
        handleClose();
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isExpanded]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isExpanded) {
        handleClose();
      }
    };

    if (isExpanded) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isExpanded]);

  const handleToggle = () => {
    if (disabled) return;
    
    if (isExpanded) {
      handleClose();
    } else {
      // Calculate menu position for inline positioning
      if (position === 'inline' && fabRef.current) {
        const rect = fabRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.top - 200, // Position above the button
          right: window.innerWidth - rect.right
        });
      }
      
      setIsAnimating(true);
      setIsExpanded(true);
      setTimeout(() => setIsAnimating(false), 200);
    }
  };

  const handleClose = () => {
    setIsAnimating(true);
    setIsExpanded(false);
    setTimeout(() => setIsAnimating(false), 200);
  };

  const handleItemCreate = (itemType) => {
    handleClose();
    onCreateItem(itemType);
  };

  // Render menu items as a portal for inline position to escape stacking context
  const renderMenu = () => {
    if (!isExpanded) return null;

    const menuContent = (
      <div 
        className={`fab-menu ${
          position === 'inline' ? '' : 'absolute'
        } ${
          position === 'fixed' ? 'bottom-16 right-0' : 
          position === 'inline' ? '' :
          'bottom-16 left-1/2 transform -translate-x-1/2'
        } flex flex-col gap-3 ${
          isAnimating ? 'fab-menu-entering' : 'fab-menu-visible'
        }`}
        style={position === 'inline' ? {
          position: 'fixed',
          top: `${menuPosition.top}px`,
          right: `${menuPosition.right}px`,
          zIndex: 9999
        } : {}}
        role="menu"
        aria-label="Item types"
        // Prevent clicks inside the menu from closing it via the outside click handler,
        // especially when using a portal.
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {itemTypes.map((item, index) => (
          <button
            key={item.type}
            onClick={() => handleItemCreate(item.type)}
            className={`fab-menu-item group flex items-center gap-3 bg-white dark:bg-zinc-800 
                     text-zinc-900 dark:text-zinc-100 px-4 py-3 rounded-full shadow-lg 
                     border border-zinc-200 dark:border-zinc-700
                     hover:bg-zinc-50 dark:hover:bg-zinc-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     transform transition-all duration-200 hover:scale-105
                     ${isAnimating ? 'fab-item-entering' : 'fab-item-visible'}`}
            style={{
              animationDelay: `${index * 50}ms`,
            }}
            role="menuitem"
            title={item.description}
          >
            <span className="text-xl" aria-hidden="true">{item.icon}</span>
            <span className="font-medium whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </div>
    );

    // Use portal for inline positioning to escape tree panel stacking context
    if (position === 'inline') {
      return createPortal(menuContent, document.body);
    }

    return menuContent;
  };

  // Render backdrop as portal for inline position
  const renderBackdrop = () => {
    if (!isExpanded || (position !== 'fixed' && position !== 'inline')) return null;

    const backdropContent = (
      <div 
        className="fab-backdrop fixed inset-0 bg-black bg-opacity-20"
        style={{ zIndex: position === 'inline' ? 9998 : -10 }}
        onClick={handleClose}
        aria-hidden="true"
      />
    );

    if (position === 'inline') {
      return createPortal(backdropContent, document.body);
    }

    return backdropContent;
  };

  return (
    <>
      {/* Backdrop */}
      {renderBackdrop()}

      <div 
        ref={fabRef}
        className={`fab-container ${
          position === 'fixed' ? 'fixed bottom-6 right-6 z-50' : 
          position === 'inline' ? 'relative fab-inline' : 
          'relative fab-in-tree'
        }`}
        role="region"
        aria-label="Create new item"
      >
        {/* Expanded menu items */}
        {renderMenu()}

        {/* Main FAB button */}
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`fab-main w-14 h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                   text-white rounded-full shadow-lg hover:shadow-xl
                   flex items-center justify-center
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   transform transition-all duration-200 hover:scale-110 active:scale-95
                   ${isExpanded ? 'fab-main-expanded' : ''}
                   ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          aria-label={isExpanded ? "Close create menu" : "Create new item"}
          aria-expanded={isExpanded}
          aria-haspopup="menu"
        >
          <svg 
            className={`w-6 h-6 transition-transform duration-200 ${
              isExpanded ? 'rotate-45' : 'rotate-0'
            }`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 4v16m8-8H4" 
            />
          </svg>
        </button>
      </div>
    </>
  );
};

export default FloatingActionButton;