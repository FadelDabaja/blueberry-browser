import React, { useState, useEffect } from "react";
import { Globe } from "lucide-react";

interface FaviconProps {
    src?: string | null;
    className?: string;
}

export const Favicon: React.FC<FaviconProps> = ({ src, className }) => {
    const [error, setError] = useState(false);

    // Reset error when src changes
    useEffect(() => {
        setError(false);
    }, [src]);

    if (!src || error) {
        return <Globe className={`size-4 text-muted-foreground ${className || ""}`} />;
    }

    return (
        <div className="size-4 overflow-hidden rounded-sm flex items-center justify-center">
            <img
                src={src}
                className="object-contain size-full"
                onError={() => setError(true)}
                alt=""
            />
        </div>
    );
};
