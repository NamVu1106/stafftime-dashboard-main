import { createContext, useContext, useState, ReactNode } from 'react';

interface DashboardTabContextType {
  activeDeptTab: string;
  setActiveDeptTab: (v: string) => void;
  selectedFunction: string | null;
  setSelectedFunction: (v: string | null) => void;
}

const DashboardTabContext = createContext<DashboardTabContextType | undefined>(undefined);

export const useDashboardTab = () => {
  const ctx = useContext(DashboardTabContext);
  if (!ctx) {
    throw new Error('useDashboardTab must be used within DashboardTabProvider');
  }
  return ctx;
};

interface DashboardTabProviderProps {
  children: ReactNode;
}

export const DashboardTabProvider = ({ children }: DashboardTabProviderProps) => {
  const [activeDeptTab, setActiveDeptTab] = useState<string>('hr');
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);

  return (
    <DashboardTabContext.Provider
      value={{
        activeDeptTab,
        setActiveDeptTab,
        selectedFunction,
        setSelectedFunction,
      }}
    >
      {children}
    </DashboardTabContext.Provider>
  );
};
