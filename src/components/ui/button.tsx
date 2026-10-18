import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /* Obsidian & gold: the primary action is brushed gold on every page. */
        default:
          "av-gold rounded-full text-[#3a0509] shadow-[0_10px_30px_rgba(217,194,154,0.22)] hover:-translate-y-0.5",
        gold: "av-gold rounded-full text-[#3a0509] font-bold hover:-translate-y-0.5",
        secondary:
          "rounded-full border border-[var(--glass-rule)] bg-white/[0.04] text-ink backdrop-blur-md hover:border-gold hover:text-gold",
        ghost: "rounded-full text-ink hover:bg-white/5 hover:text-gold",
        outline:
          "rounded-full border border-[var(--glass-rule)] bg-transparent text-ink hover:border-gold hover:text-gold",
        glass:
          "lux-glass rounded-full text-ink hover:border-gold/40",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-xs",
        lg: "h-13 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
