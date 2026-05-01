import React, { createContext, useContext, useState } from 'react';

interface MobileNavContextType {
  isToolsDrawerOpen: boolean;
  openToolsDrawer: () => void;
  closeToolsDrawer: () => void;
  toggleToolsDrawer: () => void;
}

const MobileNavContext = createContext<MobileNavContextType>({
  isToolsDrawerOpen: false,
  openToolsDrawer: () => {},
  closeToolsDrawer: () => {},
  toggleToolsDrawer: () => {},
});

export const useMobileNav = () => useContext(MobileNavContext);

export const MobileNavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isToolsDrawerOpen, setIsToolsDrawerOpen] = useState(false);

  const openToolsDrawer = () => setIsToolsDrawerOpen(true);
  const closeToolsDrawer = () => setIsToolsDrawerOpen(false);
  const toggleToolsDrawer = () => setIsToolsDrawerOpen(prev => !prev);

  return (
    <MobileNavContext.Provider
      value={{
        isToolsDrawerOpen,
        openToolsDrawer,
        closeToolsDrawer,
        toggleToolsDrawer,
      }}
    >
      {children}
    </MobileNavContext.Provider>
  );
};
