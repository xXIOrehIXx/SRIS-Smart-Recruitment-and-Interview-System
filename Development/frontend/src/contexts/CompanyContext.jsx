import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { companyAPI } from "../services/api";

const CompanyContext = createContext(null);

export const CompanyProvider = ({ children }) => {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCompany = useCallback(async () => {
    try {
      setLoading(true);
      const response = await companyAPI.get();
      setCompany(response.data);
    } catch (error) {
      console.error("CompanyContext: failed to fetch company", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load company info once on mount
  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  const refreshCompany = useCallback(() => {
    return fetchCompany();
  }, [fetchCompany]);

  const value = {
    company,
    loading,
    refreshCompany,
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompany must be used within CompanyProvider");
  }
  return context;
};
