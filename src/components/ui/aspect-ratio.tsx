import * as React from "react";

const AspectRatio = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { ratio?: number }
>(({ ratio = 1, style, ...props }, ref) => (
  <div
    ref={ref}
    style={{ position: "relative", paddingBottom: `${100 / ratio}%`, ...style }}
    {...props}
  />
));
AspectRatio.displayName = "AspectRatio";

export { AspectRatio };
