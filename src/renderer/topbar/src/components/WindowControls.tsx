import React from "react";
import { Minus, Square, X } from "lucide-react";

export const WindowControls: React.FC = () => (
  <div className="flex items-center app-region-no-drag ml-1">
    <button
      className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:bg-muted/80 transition-colors duration-150"
      onClick={() => window.topBarAPI?.minimizeWindow()}
      aria-label="Minimize window"
      title="Minimize"
    >
      <Minus className="size-4" />
    </button>
    <button
      className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:bg-muted/80 transition-colors duration-150"
      onClick={() => window.topBarAPI?.maximizeWindow()}
      aria-label="Maximize window"
      title="Maximize"
    >
      <Square className="size-3.5" />
    </button>
    <button
      className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-red-500 hover:text-white active:bg-red-600 transition-colors duration-150"
      onClick={() => window.topBarAPI?.closeWindow()}
      aria-label="Close window"
      title="Close"
    >
      <X className="size-4" />
    </button>
  </div>
);
