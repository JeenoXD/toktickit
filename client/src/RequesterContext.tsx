import { createContext, useContext, useState, ReactNode } from "react";

export type Requester = { id: number; name: string; email: string };

type RequesterContextType = {
  requester: Requester | null;
  setRequester: (r: Requester | null) => void;
};

const RequesterContext = createContext<RequesterContextType | undefined>(undefined);

export function RequesterProvider({
  children,
  initialRequester = null,
}: {
  children: ReactNode;
  initialRequester?: Requester | null;
}) {
  const [requester, setRequester] = useState<Requester | null>(initialRequester);
  return (
    <RequesterContext.Provider value={{ requester, setRequester }}>
      {children}
    </RequesterContext.Provider>
  );
}

export function useRequester() {
  const ctx = useContext(RequesterContext);
  if (!ctx) throw new Error("useRequester must be used within RequesterProvider");
  return ctx;
}