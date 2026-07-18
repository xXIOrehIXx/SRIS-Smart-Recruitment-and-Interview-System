import React, { createContext, useContext, useState, useCallback } from "react";

const BrandThemeContext = createContext(null);

const DEFAULT_COLOR = "#5D8C3E";
const STORAGE_KEY = "brand_primary_color";

export const BrandThemeProvider = ({ children }) => {
  const initialColor = localStorage.getItem(STORAGE_KEY) || DEFAULT_COLOR;
  const [primaryColor, setPrimaryColor] = useState(initialColor);

  const updateBrandColor = useCallback((color) => {
    const hex = typeof color === "string" ? color : DEFAULT_COLOR;
    setPrimaryColor(hex);
    localStorage.setItem(STORAGE_KEY, hex);
    applyBrandColorToCSS(hex);
  }, []);

  const computeShades = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const clamp = (v) => Math.max(0, Math.min(255, v));

    return {
      primary: hex,
      hover: `#${clamp(r - 25).toString(16).padStart(2, "0")}${clamp(g - 25).toString(16).padStart(2, "0")}${clamp(b - 25).toString(16).padStart(2, "0")}`,
      active: `#${clamp(r - 40).toString(16).padStart(2, "0")}${clamp(g - 40).toString(16).padStart(2, "0")}${clamp(b - 40).toString(16).padStart(2, "0")}`,
      lightBg: `rgba(${r}, ${g}, ${b}, 0.1)`,
    };
  };

  const value = {
    primaryColor,
    updateBrandColor,
    shades: computeShades(primaryColor),
  };

  applyBrandColorToCSS(primaryColor);

  return (
    <BrandThemeContext.Provider value={value}>
      {children}
    </BrandThemeContext.Provider>
  );
};

function applyBrandColorToCSS(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const clamp = (v) => Math.max(0, Math.min(255, v));

  const root = document.documentElement;
  root.style.setProperty("--brand-color", hex);
  root.style.setProperty(
    "--brand-color-hover",
    `#${clamp(r - 25).toString(16).padStart(2, "0")}${clamp(g - 25).toString(16).padStart(2, "0")}${clamp(b - 25).toString(16).padStart(2, "0")}`
  );
  root.style.setProperty(
    "--brand-color-active",
    `#${clamp(r - 40).toString(16).padStart(2, "0")}${clamp(g - 40).toString(16).padStart(2, "0")}${clamp(b - 40).toString(16).padStart(2, "0")}`
  );
  root.style.setProperty(
    "--brand-color-light",
    `rgba(${r}, ${g}, ${b}, 0.1)`
  );
}

export const useBrandTheme = () => {
  const context = useContext(BrandThemeContext);
  if (!context) {
    throw new Error("useBrandTheme must be used within BrandThemeProvider");
  }
  return context;
};
