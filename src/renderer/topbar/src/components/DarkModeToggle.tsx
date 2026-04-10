import React from "react";
import { Moon, Sun } from "lucide-react";
import { useDarkMode } from "../../../common/hooks/useDarkMode";

export const DarkModeToggle: React.FC = () => {
    const { isDarkMode, toggleDarkMode } = useDarkMode();

    return (
        <button
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="size-6 flex items-center justify-center rounded-md hover:bg-muted/50 text-foreground transition-colors"
        >
            {isDarkMode ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </button>
    );
};
