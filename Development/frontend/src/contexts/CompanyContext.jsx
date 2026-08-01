import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { companyAPI } from "../services/api";
import { useBrandTheme } from "./BrandThemeContext";

const CompanyContext = createContext(null);

const CompanyProviderInner = ({ children }) => {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const { updateBrandColor } = useBrandTheme();

  const fetchCompany = useCallback(async () => {
    // GET /api/company là endpoint CẦN đăng nhập. Provider này bọc TOÀN BỘ app (index.jsx),
    // nên khi khách vãng lai mở trang career công khai (/{slug}/career) nó vẫn bắn request,
    // ăn 401, và interceptor trong api.jsx đá thẳng về /login — trang công khai không bao giờ
    // xem được. Chưa có token thì đơn giản là không gọi: brand của trang công khai lấy từ
    // /api/public/{slug} chứ không phải từ đây.
    if (!localStorage.getItem("token")) {
      setCompany(null);
      return;
    }

    try {
      setLoading(true);
      const response = await companyAPI.get();
      const data = response.data;
      setCompany(data);

      if (data?.primaryColor) {
        updateBrandColor(data.primaryColor);
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error("CompanyContext: failed to fetch company", error);
      }
    } finally {
      setLoading(false);
    }
  }, [updateBrandColor]);

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

export const CompanyProvider = ({ children }) => (
  <CompanyProviderInner>{children}</CompanyProviderInner>
);

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompany must be used within CompanyProvider");
  }
  return context;
};
