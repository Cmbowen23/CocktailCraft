import React, { createContext, useContext, useState, useEffect } from 'react';

const ShowTagsContext = createContext();

export function ShowTagsProvider({ children }) {
  const [showTags, setShowTagsState] = useState(() => {
    const stored = localStorage.getItem('showTags');
    return stored !== null ? stored === 'true' : true;
  });

  const setShowTags = (value) => {
    setShowTagsState(value);
    localStorage.setItem('showTags', value.toString());
  };

  return (
    <ShowTagsContext.Provider value={{ showTags, setShowTags }}>
      {children}
    </ShowTagsContext.Provider>
  );
}

export function useShowTags() {
  const context = useContext(ShowTagsContext);
  if (!context) {
    throw new Error('useShowTags must be used within ShowTagsProvider');
  }
  return context;
}