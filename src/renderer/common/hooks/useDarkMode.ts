import { useState, useEffect } from "react";

// Detect which preload API is available
const getDarkModeAPI = () => {
  const api =
    (window as any).sidebarAPI ||
    (window as any).topBarAPI;
  if (api?.sendDarkModeChange) return api;
  return null;
};

export const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode !== null) {
      return JSON.parse(savedMode);
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));

    // Broadcast dark mode change to main process via typed preload API
    const api = getDarkModeAPI();
    if (api) {
      api.sendDarkModeChange(isDarkMode);
    }
  }, [isDarkMode]);

  // Listen for dark mode changes from other windows
  useEffect(() => {
    const api = getDarkModeAPI();
    if (!api) return;

    api.onDarkModeUpdate((newDarkMode: boolean) => {
      setIsDarkMode(newDarkMode);
    });

    return () => {
      api.removeDarkModeListener();
    };
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return { isDarkMode, toggleDarkMode };
};
